import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createDb } from "../../../db";
import { waitlist } from "../../../db/schema";
import { readBrevoConfig } from "../../../lib/brevo";
import { CONSENT_COPY } from "../../../lib/consent";
import { verifyTurnstile } from "../../../lib/turnstile";
import {
  claimRow,
  MAX_SYNC_ATTEMPTS,
  resendAllowed,
  syncRow,
} from "../../../lib/waitlist";

/**
 * Waitlist signup.
 *
 * Order of operations:
 *   honeypot + timing gate → Turnstile → D1 insert → Brevo DOI in waitUntil
 *
 * D1 is written before Brevo is contacted, deliberately. An ESP outage must
 * never fail the visitor's submission — the row lands with `synced_at` NULL and
 * the hourly reconciler (apps/web/workers/reconcile.ts) replays it.
 *
 * When the bindings or secrets are absent the route fails closed with 503
 * rather than logging an address it cannot store. That is also the state the
 * public site ships in until the waitlist is opened.
 */

const Body = z.object({
  // Normalised before validation: a trailing space or a capitalised domain is a
  // typo, not a malformed address, and lowercasing here is what makes the
  // unique index on `email` actually mean one address per person.
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  name: z.string().trim().max(60).optional().default(""),
  honeypot: z.string().max(200).optional().default(""),
  elapsedMs: z.number().int().nonnegative().optional().default(0),
  turnstileToken: z.string().max(2048).optional().default(""),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
});

/** Humans take longer than this to read two fields and type an email. */
const MIN_ELAPSED_MS = 2000;

function unavailable() {
  return Response.json(
    { error: "Beta registration is not open yet. Please check back soon." },
    { status: 503, headers: { "Retry-After": "86400" } },
  );
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return Response.json(
      { error: "That email doesn't look right." },
      { status: 400 },
    );
  }

  // Silently accept bot submissions. Returning an error just tells them which
  // gate they tripped, so they retune and retry.
  if (parsed.honeypot.length > 0 || parsed.elapsedMs < MIN_ELAPSED_MS) {
    return Response.json({ ok: true });
  }

  let env: CloudflareEnv;
  let ctx: { waitUntil: (promise: Promise<unknown>) => void };
  try {
    const cloudflare = getCloudflareContext();
    env = cloudflare.env;
    ctx = cloudflare.ctx;
  } catch {
    // No Worker context: local `next dev` without bindings, or a unit test.
    return unavailable();
  }

  const brevo = readBrevoConfig(env);
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  if (!env.DB || !brevo || !turnstileSecret) {
    return unavailable();
  }

  const ip = request.headers.get("cf-connecting-ip");

  if (!(await verifyTurnstile(turnstileSecret, parsed.turnstileToken, ip))) {
    return Response.json(
      { error: "We couldn't verify that you're human. Please try again." },
      { status: 400 },
    );
  }

  const email = parsed.email;
  const db = createDb(env.DB);

  const [existing] = await db
    .select({
      id: waitlist.id,
      email: waitlist.email,
      name: waitlist.name,
      status: waitlist.status,
      syncedAt: waitlist.syncedAt,
      syncAttempts: waitlist.syncAttempts,
      syncAttemptedAt: waitlist.syncAttemptedAt,
    })
    .from(waitlist)
    .where(eq(waitlist.email, email))
    .limit(1);

  if (existing) {
    // Already known. Re-sending the confirmation only makes sense while Brevo
    // has never accepted this address, and never faster than the cooldown —
    // otherwise the form is a way to mailbomb someone else's inbox one
    // submission at a time.
    const resendable =
      existing.syncedAt === null &&
      existing.status === "pending" &&
      existing.syncAttempts < MAX_SYNC_ATTEMPTS &&
      resendAllowed(existing.syncAttemptedAt);

    if (resendable) {
      // Compare-and-set: only the request that actually moves the attempt
      // counter gets to send. Two concurrent resubmissions both read the same
      // row, so without this claim both would fire a confirmation email.
      if (await claimRow(db, existing)) {
        ctx.waitUntil(
          syncRow(db, brevo, {
            ...existing,
            syncAttempts: existing.syncAttempts + 1,
          }),
        );
      }
    }

    return Response.json({ ok: true });
  }

  const row = {
    id: crypto.randomUUID(),
    email,
    name: parsed.name,
    consentCopy: CONSENT_COPY,
    source: "web",
    ip,
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("cf-ipcountry"),
    referer: request.headers.get("referer"),
    utmSource: parsed.utmSource ?? null,
    utmMedium: parsed.utmMedium ?? null,
    utmCampaign: parsed.utmCampaign ?? null,
    // The insert IS this address's first send claim: stamping the attempt here
    // is what starts the resend cooldown. Without it a second submission
    // moments later would see a fresh-looking row and send again.
    syncAttempts: 1,
    syncAttemptedAt: new Date(),
  };

  // RETURNING tells us whether this request actually created the row. Two
  // concurrent signups for the same new address both pass the SELECT above;
  // only the one whose INSERT wins should send a confirmation email.
  const inserted = await db
    .insert(waitlist)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: waitlist.id });

  if (inserted.length > 0) {
    ctx.waitUntil(syncRow(db, brevo, row));
  }

  return Response.json({ ok: true });
}
