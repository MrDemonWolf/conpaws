import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, readBodyWithLimit } from "./body-limit";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function requestWith(
  chunks: string[],
  headers: Record<string, string> = {},
): Request {
  return new Request("https://conpaws.com/api/waitlist", {
    method: "POST",
    body: streamOf(chunks),
    headers,
    // Required by undici when a stream is used as the body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("readBodyWithLimit", () => {
  it("returns a body that fits", async () => {
    const payload = JSON.stringify({ email: "fox@example.com" });
    await expect(readBodyWithLimit(requestWith([payload]))).resolves.toBe(
      payload,
    );
  });

  it("reassembles a body split across chunks", async () => {
    await expect(
      readBodyWithLimit(requestWith(['{"email":', '"fox@example.com"}'])),
    ).resolves.toBe('{"email":"fox@example.com"}');
  });

  it("rejects an oversized body before reading it, on Content-Length", async () => {
    const request = requestWith(["x"], {
      "content-length": String(MAX_BODY_BYTES + 1),
    });

    await expect(readBodyWithLimit(request)).resolves.toBeNull();
  });

  // The header is a hint, not a promise: a chunked body has none at all, and
  // nothing stops a caller from understating it.
  it("rejects an oversized body that declares no Content-Length", async () => {
    const request = requestWith(["y".repeat(MAX_BODY_BYTES + 10)]);

    await expect(readBodyWithLimit(request)).resolves.toBeNull();
  });

  it("rejects a body that only goes over part way through the stream", async () => {
    const request = requestWith([
      "z".repeat(MAX_BODY_BYTES - 5),
      "z".repeat(50),
    ]);

    await expect(readBodyWithLimit(request)).resolves.toBeNull();
  });

  it("accepts a body exactly at the limit", async () => {
    const payload = "a".repeat(MAX_BODY_BYTES);

    await expect(readBodyWithLimit(requestWith([payload]))).resolves.toBe(
      payload,
    );
  });

  it("treats a missing body as empty rather than throwing", async () => {
    const request = new Request("https://conpaws.com/api/waitlist", {
      method: "POST",
    });

    await expect(readBodyWithLimit(request)).resolves.toBe("");
  });

  it("counts bytes, not characters", async () => {
    // Four bytes per emoji: a string that looks half the limit is not.
    const request = requestWith(["🦊".repeat(MAX_BODY_BYTES / 2)]);

    await expect(readBodyWithLimit(request)).resolves.toBeNull();
  });
});
