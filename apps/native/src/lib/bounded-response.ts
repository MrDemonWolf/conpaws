export const MAX_ICS_BYTES = 8 * 1024 * 1024;

/**
 * The spec's `AbortSignal#throwIfAborted`, by hand. React Native's AbortSignal
 * is the `abort-controller` polyfill, which Expo's runtime extends with the
 * `timeout` and `any` statics only: on a device the method does not exist
 * and `signal.reason` is usually undefined, so calling it there is a
 * TypeError that reads like an ordinary fetch failure. Node has the method,
 * which is why the tests never noticed.
 */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  if (signal.reason !== undefined) throw signal.reason;
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  throw error;
}

export async function fetchStreaming(
  input: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
): Promise<Response> {
  throwIfAborted(init?.signal);
  const { fetch } = await import("expo/fetch");
  throwIfAborted(init?.signal);
  return fetch(input, init);
}

/** Reads a streaming response without ever retaining more than `maxBytes`. */
export async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new ResponseTooLargeError(declared, maxBytes);
  }

  if (!response.body) {
    throw new Error("Response body is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ResponseTooLargeError(bytes, maxBytes);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export class ResponseTooLargeError extends Error {
  constructor(
    readonly bytes: number,
    readonly limit: number,
  ) {
    super(`Response exceeded ${limit} bytes`);
    this.name = "ResponseTooLargeError";
  }
}
