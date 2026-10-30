import { describe, expect, it } from "vitest";
import { decodeAttempt, encodeAttempt, safeNextPath } from "./sign-in-cookies";
import { randomToken } from "./sign-in-crypto";

describe("where sign-in returns to", () => {
  it("accepts console paths with an optional query", () => {
    for (const path of [
      "/",
      "/team",
      "/conventions",
      "/conventions/new",
      "/conventions/3f1c9e2a-0b7d-4f7e-9a51-2a8d6c0e4b11",
      "/conventions?status=draft&query=con",
    ]) {
      expect(safeNextPath(path), path).toBe(path);
    }
  });

  it("refuses anything a browser could resolve to another site", () => {
    for (const path of [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "/.//evil.example",
      "/..//evil.example",
      "/a/..//evil.example",
      "/%2e//evil.example",
      "/a//b",
      "/./team",
      "/conventions/../team",
      "team",
      "",
      `/${"a".repeat(200)}`,
    ]) {
      expect(safeNextPath(path), path).toBeNull();
    }
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });

  it("never sends someone back to the sign-in pages", () => {
    for (const path of ["/sign-in", "/sign-in/code", "/sign-in?next=/team"]) {
      expect(safeNextPath(path), path).toBeNull();
    }
  });
});

describe("the sign-in attempt cookie", () => {
  it("round-trips its attempt, address and destination", () => {
    const attempt = {
      attemptId: randomToken(16),
      email: "member@example.com",
      next: "/team",
    };
    expect(decodeAttempt(encodeAttempt(attempt))).toEqual(attempt);
  });

  it("drops a destination that would not pass on its own", () => {
    const value = encodeAttempt({
      attemptId: randomToken(16),
      email: "member@example.com",
      next: "/.//evil.example",
    });
    expect(decodeAttempt(value)?.next).toBeNull();
  });

  it("rejects tampered or malformed values", () => {
    const good = encodeAttempt({
      attemptId: randomToken(16),
      email: "member@example.com",
      next: null,
    });
    for (const value of [
      undefined,
      null,
      "",
      "no-dot",
      `${good}.extra`,
      `short.${good.split(".")[1]}`,
      `${good.split(".")[0]}.not*base64`,
      `${good.split(".")[0]}.${btoa(JSON.stringify({ e: "not-an-email" }))}`,
    ]) {
      expect(decodeAttempt(value), String(value)).toBeNull();
    }
  });
});
