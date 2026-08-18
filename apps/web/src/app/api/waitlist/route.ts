import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createDb } from "../../../db";
import { waitlist } from "../../../db/schema";
import { readBrevoConfig } from "../../../lib/brevo";
import { CONSENT_COPY } from "../../../lib/consent";
import { verifyTurnstile } from "../../../lib/turnstile";
import { MAX_SYNC_ATTEMPTS, syncRow } from "../../../lib/waitlist";

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
    })
    .from(waitlist)
    .where(eq(waitlist.email, email))
    .limit(1);

  if (existing) {
    // Already known. Re-sending the confirmation only makes sense while Brevo
    // has never accepted this address; otherwise the form is a way to mailbomb
    // someone else's inbox one submission at a time.
    const resendable =
      existing.syncedAt === null &&
      existing.status === "pending" &&
      existing.syncAttempts < MAX_SYNC_ATTEMPTS;

    if (resendable) {
      ctx.waitUntil(syncRow(db, brevo, existing));
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
  };

  await db.insert(waitlist).values(row).onConflictDoNothing();

  ctx.waitUntil(syncRow(db, brevo, { ...row, syncAttempts: 0 }));

  return Response.json({ ok: true });
}
