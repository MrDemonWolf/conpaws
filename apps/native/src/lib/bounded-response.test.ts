import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ResponseTooLargeError,
  readResponseTextWithLimit,
  throwIfAborted,
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

describe("throwIfAborted", () => {
  // React Native's AbortSignal is the abort-controller polyfill: no
  // `throwIfAborted`, and usually no `reason`. Node has both, so these
  // tests hand the helper polyfill-shaped objects on purpose.
  it("returns when there is no signal or it is not aborted", () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
    expect(() =>
      throwIfAborted({ aborted: false } as AbortSignal),
    ).not.toThrow();
  });

  it("throws an AbortError for an aborted signal without a reason", () => {
    let caught: unknown;
    try {
      throwIfAborted({ aborted: true } as AbortSignal);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe("AbortError");
  });

  it("throws the signal's own reason when it has one", () => {
    const reason = new Error("timed out");
    expect(() =>
      throwIfAborted({ aborted: true, reason } as AbortSignal),
    ).toThrow(reason);
  });

  it("is the only way the native source checks an aborted signal", () => {
    const roots = ["src", "app"].map((dir) =>
      path.resolve(__dirname, "../..", dir),
    );
    const offenders = roots.flatMap((root) =>
      readdirSync(root, { recursive: true, encoding: "utf8" })
        .filter(
          (file) =>
            /\.tsx?$/.test(file) &&
            !/\.test\.tsx?$/.test(file) &&
            !file.includes("__mocks__"),
        )
        .filter((file) =>
          readFileSync(path.join(root, file), "utf8").includes(
            ".throwIfAborted(",
          ),
        )
        .map((file) => path.join(path.basename(root), file)),
    );
    expect(offenders).toEqual([]);
  });
});
