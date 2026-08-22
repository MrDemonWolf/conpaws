/**
 * The largest request body the waitlist accepts.
 *
 * The real payload is an email, an optional name, three UTM fields and a
 * Turnstile token — under 3KB even when every field is at its schema maximum.
 * 8KB leaves room for header-ish slack without leaving the endpoint open.
 */
export const MAX_BODY_BYTES = 8 * 1024;

/**
 * Read a request body, refusing anything over `maxBytes`.
 *
 * `request.json()` buffers whatever arrives before any validation runs, so an
 * unauthenticated caller can spend the Worker's memory and CPU on a payload
 * that was never going to parse. Zod's field caps do not help: they are
 * applied to a value that has already been decoded.
 *
 * Content-Length is checked first because it rejects the common case without
 * reading a byte, but it is only a hint — a chunked body has none, and a lying
 * header is free to send. The stream is therefore counted as it arrives and
 * cancelled the moment it goes over.
 *
 * Returns null when the body is too large; callers answer 413.
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const body = request.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(joined);
}
