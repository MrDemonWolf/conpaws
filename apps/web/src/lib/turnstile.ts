const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Capped like the listmonk calls, and for a sharper reason: this one is on the
 * synchronous request path, so a stalled siteverify holds the visitor's own
 * request open rather than a background task.
 */
const TIMEOUT_MS = 5_000;

/**
 * Server-side Turnstile verification.
 *
 * Tokens are single-use and expire after 300s, so this is called exactly once
 * per submission and its result is never cached.
 *
 * Returns false on a network failure as well as on a rejected token: a
 * signup we cannot verify is not a signup we accept.
 */
export async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  if (token.length === 0) return false;

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return false;

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
