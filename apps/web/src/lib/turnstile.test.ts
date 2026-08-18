import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstile } from "./turnstile";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyTurnstile", () => {
  it("rejects an empty token without calling Cloudflare", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(verifyTurnstile("secret", "", null)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a token Cloudflare reports as successful", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: true }),
    );

    await expect(
      verifyTurnstile("secret", "token", "203.0.113.7"),
    ).resolves.toBe(true);
  });

  it("rejects a token Cloudflare reports as failed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: false, "error-codes": ["invalid-input"] }),
    );

    await expect(verifyTurnstile("secret", "token", null)).resolves.toBe(false);
  });

  it("fails closed when siteverify is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(verifyTurnstile("secret", "token", null)).resolves.toBe(false);
  });
});
