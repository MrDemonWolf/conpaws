import { describe, expect, it } from "vitest";
import {
  formatSignInCode,
  fromBase64Url,
  generateSignInCode,
  hashSessionToken,
  hashSignInCode,
  isRandomToken,
  normalizeSignInCode,
  randomToken,
  toBase64Url,
  verifySignInCodeHash,
} from "./sign-in-crypto";

const secret = "a".repeat(64);

describe("sign-in codes", () => {
  it("are eight digits, leading zeros included", () => {
    const codes = Array.from({ length: 500 }, generateSignInCode);
    for (const code of codes) expect(code).toMatch(/^\d{8}$/);
    // Every leading digit turns up across 500 draws unless the draw is broken.
    expect(new Set(codes.map((code) => code[0])).size).toBe(10);
    expect(new Set(codes).size).toBeGreaterThan(490);
  });

  it("accept the formats people type or paste", () => {
    expect(normalizeSignInCode("12345678")).toBe("12345678");
    expect(normalizeSignInCode("1234-5678")).toBe("12345678");
    expect(normalizeSignInCode(" 1234 5678 ")).toBe("12345678");
    expect(normalizeSignInCode("1234567")).toBeNull();
    expect(normalizeSignInCode("123456789")).toBeNull();
    expect(normalizeSignInCode("1234567a")).toBeNull();
    expect(normalizeSignInCode("")).toBeNull();
    expect(formatSignInCode("01234567")).toBe("0123-4567");
  });

  it("are stored as an HMAC bound to the attempt and the address", async () => {
    const hash = await hashSignInCode(
      secret,
      "attempt",
      "a@example.com",
      "01234567",
    );
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("01234567");

    await expect(
      verifySignInCodeHash(
        secret,
        "attempt",
        "a@example.com",
        "01234567",
        hash,
      ),
    ).resolves.toBe(true);
    for (const [label, args] of [
      ["wrong digits", [secret, "attempt", "a@example.com", "01234568"]],
      ["other attempt", [secret, "other", "a@example.com", "01234567"]],
      ["other address", [secret, "attempt", "b@example.com", "01234567"]],
      ["other key", ["b".repeat(64), "attempt", "a@example.com", "01234567"]],
    ] as const) {
      await expect(
        verifySignInCodeHash(args[0], args[1], args[2], args[3], hash),
        label,
      ).resolves.toBe(false);
    }
    await expect(
      verifySignInCodeHash(
        secret,
        "attempt",
        "a@example.com",
        "01234567",
        "zz",
      ),
    ).resolves.toBe(false);
    await expect(
      verifySignInCodeHash(secret, "attempt", "a@example.com", "01234567", ""),
    ).resolves.toBe(false);
  });
});

describe("tokens", () => {
  it("are random, URL-safe and recognisable by shape", () => {
    const session = randomToken(32);
    const attempt = randomToken(16);
    expect(session).toHaveLength(43);
    expect(attempt).toHaveLength(22);
    expect(isRandomToken(session, 32)).toBe(true);
    expect(isRandomToken(attempt, 16)).toBe(true);
    expect(isRandomToken(attempt, 32)).toBe(false);
    expect(isRandomToken(`${session.slice(0, 42)}=`, 32)).toBe(false);
    expect(randomToken(32)).not.toBe(session);
  });

  it("hash to a stable SHA-256 that does not contain the token", async () => {
    const token = randomToken(32);
    const hash = await hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    await expect(hashSessionToken(token)).resolves.toBe(hash);
    await expect(hashSessionToken(randomToken(32))).resolves.not.toBe(hash);
  });

  it("round-trip through base64url and reject anything else", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = toBase64Url(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url(encoded)).toEqual(bytes);
    expect(fromBase64Url("not base64!")).toBeNull();
    expect(fromBase64Url("a+b/")).toBeNull();
  });
});
