import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function request(body: unknown): Request {
  return new Request("https://conpaws.com/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/waitlist", () => {
  it("rejects malformed signup data", async () => {
    const response = await POST(
      request({ email: "not-an-email", elapsedMs: 3_000 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "That email doesn't look right.",
    });
  });

  it("silently accepts bot-shaped submissions", async () => {
    const response = await POST(
      request({
        email: "bot@example.com",
        honeypot: "spam",
        elapsedMs: 3_000,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not claim success or log PII before persistence is available", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(
      request({ email: "person@example.com", name: "Paws", elapsedMs: 3_000 }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("86400");
    await expect(response.json()).resolves.toEqual({
      error: "Beta registration is not open yet. Please check back soon.",
    });
    expect(info).not.toHaveBeenCalled();
  });
});
