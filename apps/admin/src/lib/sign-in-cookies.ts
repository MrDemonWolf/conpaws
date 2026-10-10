import type { AdminBindings } from "./db";
import { signInEmailSchema } from "./sign-in";
import { fromBase64Url, isRandomToken, toBase64Url } from "./sign-in-crypto";

export function isLocalRuntime(env: AdminBindings) {
  return env.ADMIN_RUNTIME_ENV === "local";
}

/**
 * `__Host-` cookies must be Secure, host-only and on Path=/, so a subdomain or
 * plain-HTTP page can never set or overwrite them. Local development runs on
 * plain HTTP, where not every browser keeps Secure cookies, so it drops the
 * prefix. Anything other than the local runtime gets the strict form.
 */
export function sessionCookieName(env: AdminBindings) {
  return isLocalRuntime(env)
    ? "conpaws_admin_session"
    : "__Host-conpaws_admin_session";
}

export function attemptCookieName(env: AdminBindings) {
  return isLocalRuntime(env)
    ? "conpaws_admin_sign_in"
    : "__Host-conpaws_admin_sign_in";
}

export function cookieOptions(env: AdminBindings, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: !isLocalRuntime(env),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Where to go after signing in: a same-site path, never back to sign-in. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || value.length > 200) return null;
  if (!/^\/[A-Za-z0-9\-._~/?=&%]*$/.test(value)) return null;
  if (value.startsWith("//") || value.startsWith("/sign-in")) return null;
  return value;
}

/**
 * The browser's sign-in attempt. Its id is what the emailed code is bound
 * to; the address and destination are only for showing the code page and
 * returning afterwards. The server never trusts the address in here: the
 * signed-in identity always comes from the code's own database row.
 */
export interface SignInAttempt {
  attemptId: string;
  email: string;
  next: string | null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeAttempt(attempt: SignInAttempt) {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ e: attempt.email, n: attempt.next })),
  );
  return `${attempt.attemptId}.${payload}`;
}

export function decodeAttempt(
  value: string | undefined | null,
): SignInAttempt | null {
  if (!value || value.length > 1024) return null;
  const [attemptId, payload, extra] = value.split(".");
  if (!attemptId || !payload || extra !== undefined) return null;
  if (!isRandomToken(attemptId, 16)) return null;
  const bytes = fromBase64Url(payload);
  if (!bytes) return null;
  try {
    const data = JSON.parse(decoder.decode(bytes)) as {
      e?: unknown;
      n?: unknown;
    };
    const email = signInEmailSchema.safeParse(data?.e);
    if (!email.success) return null;
    return {
      attemptId,
      email: email.data,
      next: safeNextPath(typeof data.n === "string" ? data.n : null),
    };
  } catch {
    return null;
  }
}
