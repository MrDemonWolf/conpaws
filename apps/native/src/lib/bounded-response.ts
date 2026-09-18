export const MAX_ICS_BYTES = 8 * 1024 * 1024;

export async function fetchStreaming(
  input: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
): Promise<Response> {
  init?.signal?.throwIfAborted();
  const { fetch } = await import("expo/fetch");
  init?.signal?.throwIfAborted();
  return fetch(input, init);
}

/** Reads a streaming response without ever retaining more than `maxBytes`. */
export async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
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
