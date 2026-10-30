/**
 * The cryptography behind email-code sign-in, on Web Crypto only so it runs
 * the same in the Worker and in Node tests.
 */

const encoder = new TextEncoder();

/** Codes are eight digits: 100 million possibilities, five guesses each. */
export const SIGN_IN_CODE_DIGITS = 8;

export function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const binary = atob(
      value.replaceAll("-", "+").replaceAll("_", "/") +
        "=".repeat((4 - (value.length % 4)) % 4),
    );
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A random URL-safe token: 16 bytes for attempt ids, 32 for sessions. */
export function randomToken(byteLength: 16 | 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** The exact shape `randomToken` produces, so junk never reaches the database. */
export function isRandomToken(value: string, byteLength: 16 | 32) {
  const length = Math.ceil((byteLength * 4) / 3);
  return value.length === length && /^[A-Za-z0-9_-]+$/.test(value);
}

/**
 * A uniformly random eight-digit code. Values at or above the largest multiple
 * of 10^8 that fits in 32 bits are redrawn, so no code is likelier than another.
 */
export function generateSignInCode() {
  const range = 10 ** SIGN_IN_CODE_DIGITS;
  const ceiling = Math.floor(2 ** 32 / range) * range;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? ceiling;
    if (value < ceiling) {
      return String(value % range).padStart(SIGN_IN_CODE_DIGITS, "0");
    }
  }
}

/** Accepts "12345678", "1234-5678" and "1234 5678"; anything else is null. */
export function normalizeSignInCode(input: string) {
  const digits = input.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${SIGN_IN_CODE_DIGITS}}$`).test(digits)
    ? digits
    : null;
}

export function formatSignInCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function fromHex(value: string) {
  if (!/^(?:[0-9a-f]{2})+$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function importCodeKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * The code is bound to the browser attempt and the address it was sent to,
 * so the same digits are worthless anywhere else.
 */
function codeMessage(attemptId: string, email: string, code: string) {
  return encoder.encode(
    `conpaws-admin-sign-in\n${attemptId}\n${email}\n${code}`,
  );
}

export async function hashSignInCode(
  secret: string,
  attemptId: string,
  email: string,
  code: string,
) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importCodeKey(secret),
    codeMessage(attemptId, email, code),
  );
  return toHex(new Uint8Array(signature));
}

/** HMAC verification is constant-time, unlike comparing two strings. */
export async function verifySignInCodeHash(
  secret: string,
  attemptId: string,
  email: string,
  code: string,
  storedHash: string,
) {
  const expected = fromHex(storedHash);
  if (!expected) return false;
  return crypto.subtle.verify(
    "HMAC",
    await importCodeKey(secret),
    expected,
    codeMessage(attemptId, email, code),
  );
}

/**
 * A stable, keyed stand-in for the requesting network, so send limits can be
 * counted per network without storing anyone's IP address. Keyed, because an
 * unkeyed hash of an IPv4 address can be reversed by trying them all.
 */
export async function hashRequester(secret: string, address: string) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importCodeKey(secret),
    encoder.encode(`conpaws-admin-requester\n${address}`),
  );
  return toHex(new Uint8Array(signature)).slice(0, 32);
}

/**
 * Session tokens are 256 random bits, so a plain SHA-256 is enough to make a
 * stolen copy of the sessions table useless; no key is needed.
 */
export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toHex(new Uint8Array(digest));
}
