import { z } from "zod";

/**
 * Waitlist signup.
 *
 * Order of operations (CON-28):
 *   honeypot + timing gate → Turnstile → D1 insert → Brevo DOI in waitUntil
 *
 * D1 and Brevo are not wired yet — CON-24 installs the Cloudflare adapter,
 * CON-25 creates the database, CON-32 sets up Brevo. Until then this validates
 * and logs, so the form flow is real end to end but nothing is persisted.
 * It deliberately does NOT pretend to store anything.
 */

const Body = z.object({
  email: z.email().max(254),
  name: z.string().trim().max(60).optional().default(""),
  honeypot: z.string().max(200).optional().default(""),
  elapsedMs: z.number().int().nonnegative().optional().default(0),
});

/** Humans take longer than this to read two fields and type an email. */
const MIN_ELAPSED_MS = 2000;

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

  // The consent record — this row, not a checkbox, is what proves consent
  // under GDPR Art. 7(1) and CASL. Captured now so it is never backfilled.
  const signup = {
    email: parsed.email.toLowerCase(),
    name: parsed.name,
    createdAt: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") ?? null,
    userAgent: request.headers.get("user-agent") ?? null,
    country: request.headers.get("cf-ipcountry") ?? null,
    referer: request.headers.get("referer") ?? null,
    consentCopy:
      "iOS and Android at launch. We'll email once to confirm — nothing else until it's ready.",
    source: "web" as const,
  };

  // TODO(CON-25): insert into D1 via Drizzle, with `synced_at` NULL.
  // TODO(CON-28): ctx.waitUntil(brevoDoubleOptinConfirmation(signup)).
  // TODO(CON-29): cron reconciler replays rows where synced_at IS NULL.
  console.info("[waitlist] signup (not yet persisted)", signup);

  return Response.json({ ok: true });
}
