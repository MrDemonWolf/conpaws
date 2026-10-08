import { describe, expect, it } from "vitest";
import {
  ResponseTooLargeError,
  readResponseTextWithLimit,
} from "./bounded-response";

describe("readResponseTextWithLimit", () => {
  it("cancels an oversized declared response before throwing", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(body, {
      headers: { "content-length": "100" },
    });
    await expect(
      readResponseTextWithLimit(response, 10),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
    expect(cancelled).toBe(true);
  });
});
