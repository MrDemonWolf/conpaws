import { z } from "zod";

/**
 * Waitlist signup.
 *
 * Order of operations (CON-28):
 *   honeypot + timing gate → Turnstile → D1 insert → Brevo DOI in waitUntil
 *
 * D1 and Brevo are not wired yet. Until they are, bot-shaped requests receive
 * the usual decoy success while valid human submissions receive 503. This keeps
 * the public endpoint honest and prevents email addresses from being logged or
 * silently discarded.
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

  // TODO(CON-25): insert into D1 via Drizzle, with `synced_at` NULL.
  // TODO(CON-28): ctx.waitUntil(brevoDoubleOptinConfirmation(signup)).
  // TODO(CON-29): cron reconciler replays rows where synced_at IS NULL.
  return Response.json(
    { error: "Beta registration is not open yet. Please check back soon." },
    {
      status: 503,
      headers: { "Retry-After": "86400" },
    },
  );
}
