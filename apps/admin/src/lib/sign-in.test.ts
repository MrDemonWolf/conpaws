import { describe, expect, it, vi } from "vitest";
import {
  addInvite,
  addMember,
  createTestCatalog,
  type TestCatalog,
} from "../test/d1-sqlite";
import {
  admitMember,
  checkSignInCode,
  endAllSessions,
  endSession,
  isFreshSession,
  issueSignInCode,
  readSession,
  SIGN_IN_POLICY,
  signInSecret,
  startSession,
} from "./sign-in";
import { hashSessionToken, randomToken } from "./sign-in-crypto";

const secret = "s".repeat(64);
const MINUTE = 60_000;
const T0 = Date.UTC(2026, 9, 10, 12);

function issue(
  catalog: TestCatalog,
  email: string,
  options: { attemptId?: string; now?: number } = {},
) {
  const sent: string[] = [];
  const deliver = vi.fn(async (code: string) => {
    sent.push(code);
    return true;
  });
  const attemptId = options.attemptId ?? randomToken(16);
  return issueSignInCode({
    database: catalog.database,
    secret,
    attemptId,
    email,
    now: options.now ?? T0,
    deliver,
  }).then((result) => ({ result, code: sent[0], deliver, attemptId }));
}

function check(
  catalog: TestCatalog,
  attemptId: string,
  code: string,
  now = T0 + MINUTE,
) {
  return checkSignInCode({
    database: catalog.database,
    secret,
    attemptId,
    code,
    now,
  });
}

function wrongCode(code: string) {
  return String((Number(code) + 1) % 100_000_000).padStart(8, "0");
}

describe("sending a code", () => {
  it("sends to an active member and stores only an HMAC of the code", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { result, code, attemptId } = await issue(
      catalog,
      "member@example.com",
    );
    expect(result).toBe("sent");
    expect(code).toMatch(/^\d{8}$/);

    const rows = catalog.rows<{ code_hash: string; attempt_id: string }>(
      "SELECT code_hash, attempt_id FROM admin_sign_in_codes",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempt_id).toBe(attemptId);
    expect(rows[0]?.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.code_hash).not.toContain(code);
  });

  it("sends nothing to an address that is not on the team", async () => {
    const catalog = createTestCatalog();
    const { result, deliver } = await issue(catalog, "stranger@example.com");
    expect(result).toBe("ineligible");
    expect(deliver).not.toHaveBeenCalled();
    expect(catalog.rows("SELECT * FROM admin_sign_in_codes")).toEqual([]);
  });

  it("sends to a live invite but not to an expired one", async () => {
    const catalog = createTestCatalog();
    addInvite(catalog, "live@example.com", { expiresAt: T0 + MINUTE });
    addInvite(catalog, "old@example.com", { expiresAt: T0 });
    expect((await issue(catalog, "live@example.com")).result).toBe("sent");
    expect((await issue(catalog, "old@example.com")).result).toBe("ineligible");
  });

  it("never sends to a disabled member, invite or not", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "off@example.com", "editor", "disabled");
    addInvite(catalog, "off@example.com", { expiresAt: T0 + 60 * MINUTE });
    const { result, deliver } = await issue(catalog, "off@example.com");
    expect(result).toBe("ineligible");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("waits a minute between codes and caps them per hour and per day", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    expect(
      (await issue(catalog, "member@example.com", { now: T0 })).result,
    ).toBe("sent");
    expect(
      (await issue(catalog, "member@example.com", { now: T0 + 59_000 })).result,
    ).toBe("throttled");

    for (let index = 1; index < SIGN_IN_POLICY.maxCodesPerHour; index += 1) {
      expect(
        (
          await issue(catalog, "member@example.com", {
            now: T0 + index * 61_000,
          })
        ).result,
      ).toBe("sent");
    }
    expect(
      (await issue(catalog, "member@example.com", { now: T0 + 10 * 61_000 }))
        .result,
    ).toBe("throttled");

    // Five more over the following hours reach the daily cap of ten.
    const later = T0 + 61 * MINUTE;
    for (let index = 0; index < 5; index += 1) {
      expect(
        (
          await issue(catalog, "member@example.com", {
            now: later + index * 61_000,
          })
        ).result,
      ).toBe("sent");
    }
    expect(
      (
        await issue(catalog, "member@example.com", {
          now: later + 125 * MINUTE,
        })
      ).result,
    ).toBe("throttled");
    expect(
      (
        await issue(catalog, "member@example.com", {
          now: T0 + 25 * 60 * MINUTE,
        })
      ).result,
    ).toBe("sent");
  });

  it("reports a code the mail service did not accept", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const result = await issueSignInCode({
      database: catalog.database,
      secret,
      attemptId: randomToken(16),
      email: "member@example.com",
      now: T0,
      deliver: async () => false,
    });
    expect(result).toBe("undelivered");
  });
});

describe("checking a code", () => {
  it("accepts the right code once", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { code, attemptId } = await issue(catalog, "member@example.com");
    await expect(check(catalog, attemptId, code ?? "")).resolves.toEqual({
      status: "valid",
      email: "member@example.com",
    });
    await expect(check(catalog, attemptId, code ?? "")).resolves.toEqual({
      status: "expired",
    });
  });

  it("allows five tries per code, then refuses even the right one", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { code = "", attemptId } = await issue(catalog, "member@example.com");
    for (let index = 1; index < SIGN_IN_POLICY.maxAttemptsPerCode; index += 1) {
      await expect(check(catalog, attemptId, wrongCode(code))).resolves.toEqual(
        {
          status: "wrong",
        },
      );
    }
    await expect(check(catalog, attemptId, wrongCode(code))).resolves.toEqual({
      status: "locked",
    });
    await expect(check(catalog, attemptId, code)).resolves.toEqual({
      status: "expired",
    });
  });

  it("counts parallel guesses against the same five tries", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { code = "", attemptId } = await issue(catalog, "member@example.com");
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        check(catalog, attemptId, wrongCode(code)),
      ),
    );
    const spent = results.filter((entry) => entry.status !== "expired");
    expect(spent).toHaveLength(SIGN_IN_POLICY.maxAttemptsPerCode);
    expect(
      catalog.rows<{ attempts: number }>(
        "SELECT attempts FROM admin_sign_in_codes",
      )[0]?.attempts,
    ).toBe(SIGN_IN_POLICY.maxAttemptsPerCode);
  });

  it("only works in the browser attempt that asked for it", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { code = "" } = await issue(catalog, "member@example.com");
    await expect(check(catalog, randomToken(16), code)).resolves.toEqual({
      status: "expired",
    });
  });

  it("expires after ten minutes", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { code = "", attemptId } = await issue(catalog, "member@example.com");
    await expect(
      check(catalog, attemptId, code, T0 + SIGN_IN_POLICY.codeLifetimeMs),
    ).resolves.toEqual({ status: "expired" });
  });

  it("replaces the attempt's earlier code when a new one is sent", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const first = await issue(catalog, "member@example.com");
    const second = await issue(catalog, "member@example.com", {
      attemptId: first.attemptId,
      now: T0 + 61_000,
    });
    expect(second.result).toBe("sent");
    if (first.code !== second.code) {
      await expect(
        check(catalog, first.attemptId, first.code ?? "", T0 + 62_000),
      ).resolves.toEqual({ status: "wrong" });
    }
    await expect(
      check(catalog, first.attemptId, second.code ?? "", T0 + 62_000),
    ).resolves.toEqual({ status: "valid", email: "member@example.com" });
  });

  it("keeps the earlier code working when a resend is throttled", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const first = await issue(catalog, "member@example.com");
    const again = await issue(catalog, "member@example.com", {
      attemptId: first.attemptId,
      now: T0 + 1_000,
    });
    expect(again.result).toBe("throttled");
    await expect(
      check(catalog, first.attemptId, first.code ?? ""),
    ).resolves.toEqual({ status: "valid", email: "member@example.com" });
  });

  it("kills the address's other outstanding codes once one is used", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const laptop = await issue(catalog, "member@example.com");
    const phone = await issue(catalog, "member@example.com", {
      now: T0 + 61_000,
    });
    await expect(
      check(catalog, phone.attemptId, phone.code ?? "", T0 + 62_000),
    ).resolves.toMatchObject({ status: "valid" });
    await expect(
      check(catalog, laptop.attemptId, laptop.code ?? "", T0 + 62_000),
    ).resolves.toEqual({ status: "expired" });
  });
});

describe("letting a verified address in", () => {
  it("admits an active member with their role", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "owner@example.com", "owner");
    await expect(
      admitMember({
        database: catalog.database,
        email: "owner@example.com",
        now: T0,
      }),
    ).resolves.toEqual({ status: "member", role: "owner" });
  });

  it("turns a live invite into a membership, once, and records it", async () => {
    const catalog = createTestCatalog();
    addInvite(catalog, "new@example.com", {
      role: "owner",
      expiresAt: T0 + MINUTE,
      invitedBy: "boss@example.com",
    });
    await expect(
      admitMember({
        database: catalog.database,
        email: "new@example.com",
        now: T0,
      }),
    ).resolves.toEqual({ status: "member", role: "owner" });
    expect(
      catalog.rows("SELECT email, role, status, created_by FROM admin_members"),
    ).toEqual([
      {
        email: "new@example.com",
        role: "owner",
        status: "active",
        created_by: "boss@example.com",
      },
    ]);
    expect(catalog.rows("SELECT * FROM admin_invites")).toEqual([]);
    expect(catalog.rows("SELECT action, summary FROM audit_log")).toEqual([
      {
        action: "admin.invite-accepted",
        summary: "Accepted an invite as owner",
      },
    ]);

    // Signing in again is an ordinary member sign-in and records nothing new.
    await admitMember({
      database: catalog.database,
      email: "new@example.com",
      now: T0,
    });
    expect(catalog.rows("SELECT * FROM audit_log")).toHaveLength(1);
  });

  it("refuses an expired invite and an address with no invite", async () => {
    const catalog = createTestCatalog();
    addInvite(catalog, "late@example.com", { expiresAt: T0 });
    await expect(
      admitMember({
        database: catalog.database,
        email: "late@example.com",
        now: T0,
      }),
    ).resolves.toEqual({ status: "not-invited" });
    await expect(
      admitMember({
        database: catalog.database,
        email: "who@example.com",
        now: T0,
      }),
    ).resolves.toEqual({ status: "not-invited" });
    expect(catalog.rows("SELECT * FROM admin_members")).toEqual([]);
  });

  it("never re-enables a disabled member through an invite", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "off@example.com", "editor", "disabled");
    addInvite(catalog, "off@example.com", {
      role: "owner",
      expiresAt: T0 + MINUTE,
    });
    await expect(
      admitMember({
        database: catalog.database,
        email: "off@example.com",
        now: T0,
      }),
    ).resolves.toEqual({ status: "disabled" });
    expect(catalog.rows("SELECT role, status FROM admin_members")).toEqual([
      { role: "editor", status: "disabled" },
    ]);
  });
});

describe("sessions", () => {
  it("store only a hash of the cookie token and read back the member", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com", "editor");
    const token = await startSession({
      database: catalog.database,
      email: "member@example.com",
      now: T0,
    });
    const rows = catalog.rows<{ token_hash: string }>(
      "SELECT token_hash FROM admin_sessions",
    );
    expect(rows).toEqual([{ token_hash: await hashSessionToken(token) }]);
    expect(rows[0]?.token_hash).not.toContain(token);

    await expect(readSession(catalog.database, token, T0 + 1)).resolves.toEqual(
      {
        email: "member@example.com",
        verifiedAt: T0,
        expiresAt: T0 + SIGN_IN_POLICY.sessionLifetimeMs,
        role: "editor",
        status: "active",
      },
    );
    expect(catalog.rows("SELECT action FROM audit_log")).toEqual([
      { action: "admin.signed-in" },
    ]);
  });

  it("expire after seven days and ignore malformed tokens", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const token = await startSession({
      database: catalog.database,
      email: "member@example.com",
      now: T0,
    });
    await expect(
      readSession(
        catalog.database,
        token,
        T0 + SIGN_IN_POLICY.sessionLifetimeMs,
      ),
    ).resolves.toBeNull();
    await expect(readSession(catalog.database, "nope", T0)).resolves.toBeNull();
    await expect(
      readSession(catalog.database, randomToken(32), T0),
    ).resolves.toBeNull();
  });

  it("replace the browser's previous session and sweep old rows", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const old = await startSession({
      database: catalog.database,
      email: "member@example.com",
      now: T0,
    });
    catalog.exec(
      "INSERT INTO admin_sign_in_codes (id, attempt_id, email, code_hash, created_at, expires_at) VALUES ('old', 'a', 'member@example.com', 'x', ?, ?)",
      T0 - SIGN_IN_POLICY.codeRetentionMs - 1,
      T0,
    );
    const fresh = await startSession({
      database: catalog.database,
      email: "member@example.com",
      now: T0 + MINUTE,
      replacingToken: old,
    });
    await expect(
      readSession(catalog.database, old, T0 + MINUTE),
    ).resolves.toBeNull();
    await expect(
      readSession(catalog.database, fresh, T0 + MINUTE),
    ).resolves.toMatchObject({ email: "member@example.com" });
    expect(catalog.rows("SELECT id FROM admin_sign_in_codes")).toEqual([]);
  });

  it("end one at a time or all at once", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const start = (now: number) =>
      startSession({
        database: catalog.database,
        email: "member@example.com",
        now,
      });
    const first = await start(T0);
    const second = await start(T0 + 1);
    const third = await start(T0 + 2);
    await endSession(catalog.database, first);
    await expect(
      readSession(catalog.database, first, T0 + 3),
    ).resolves.toBeNull();
    await expect(
      readSession(catalog.database, second, T0 + 3),
    ).resolves.not.toBeNull();
    await endAllSessions(catalog.database, "member@example.com");
    await expect(
      readSession(catalog.database, second, T0 + 3),
    ).resolves.toBeNull();
    await expect(
      readSession(catalog.database, third, T0 + 3),
    ).resolves.toBeNull();
  });

  it("count as fresh for team changes for two hours after a code", () => {
    expect(isFreshSession({ verifiedAt: T0 }, T0 + 119 * MINUTE)).toBe(true);
    expect(isFreshSession({ verifiedAt: T0 }, T0 + 120 * MINUTE)).toBe(false);
  });
});

describe("the code key", () => {
  it("uses the deployed secret and falls back only in local development", () => {
    expect(signInSecret({ ADMIN_AUTH_SECRET: "k".repeat(64) })).toBe(
      "k".repeat(64),
    );
    expect(signInSecret({ ADMIN_RUNTIME_ENV: "production" })).toBeNull();
    expect(signInSecret({})).toBeNull();
    expect(
      signInSecret({
        ADMIN_RUNTIME_ENV: "production",
        ADMIN_AUTH_SECRET: "short",
      }),
    ).toBeNull();
    expect(signInSecret({ ADMIN_RUNTIME_ENV: "local" })).toEqual(
      expect.any(String),
    );
  });
});
