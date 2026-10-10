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
  endEverySession,
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
const HOUR = 60 * MINUTE;
const T0 = Date.UTC(2026, 9, 10, 12);

function issue(
  catalog: TestCatalog,
  email: string,
  options: {
    attemptId?: string;
    now?: number;
    requester?: string;
    signedInAsAddress?: boolean;
  } = {},
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
    requester: options.requester ?? "network-a",
    now: options.now ?? T0,
    signedInAsAddress: options.signedInAsAddress,
    deliver,
  }).then((result) => ({ result, code: sent[0] ?? "", deliver, attemptId }));
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

async function signIn(catalog: TestCatalog, email: string, now = T0) {
  const token = await startSession({ database: catalog.database, email, now });
  if (!token) throw new Error("expected a session");
  return token;
}

function liveCodes(catalog: TestCatalog) {
  return catalog.rows(
    "SELECT id FROM admin_sign_in_codes WHERE consumed_at IS NULL",
  );
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

    const rows = catalog.rows<{
      code_hash: string;
      attempt_id: string;
      requester: string;
    }>("SELECT code_hash, attempt_id, requester FROM admin_sign_in_codes");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempt_id).toBe(attemptId);
    expect(rows[0]?.requester).toBe("network-a");
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
    addInvite(catalog, "off@example.com", { expiresAt: T0 + HOUR });
    const { result, deliver } = await issue(catalog, "off@example.com");
    expect(result).toBe("ineligible");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("limits one network to a code a minute, five an hour and ten a day", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const send = (now: number) =>
      issue(catalog, "member@example.com", { now }).then(
        ({ result }) => result,
      );

    expect(await send(T0)).toBe("sent");
    expect(await send(T0 + 59_000)).toBe("throttled");
    for (
      let index = 1;
      index < SIGN_IN_POLICY.maxCodesPerNetworkHour;
      index += 1
    ) {
      expect(await send(T0 + index * 61_000)).toBe("sent");
    }
    expect(await send(T0 + 10 * 61_000)).toBe("throttled");

    // Five more over the following hours reach the network's daily ten.
    const later = T0 + 61 * MINUTE;
    for (let index = 0; index < 5; index += 1) {
      expect(await send(later + index * 61_000)).toBe("sent");
    }
    expect(await send(later + 125 * MINUTE)).toBe("throttled");
    expect(await send(T0 + 25 * HOUR)).toBe("sent");
  });

  it("does not let someone on another network use up a member's allowance", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "owner@example.com", "owner");
    // A stranger burns through their own network's whole daily allowance.
    for (
      let index = 0;
      index < SIGN_IN_POLICY.maxCodesPerNetworkDay;
      index += 1
    ) {
      await issue(catalog, "owner@example.com", {
        requester: "stranger",
        now: T0 + index * 61 * MINUTE,
      });
    }
    expect(
      (
        await issue(catalog, "owner@example.com", {
          requester: "stranger",
          now: T0 + 11 * HOUR,
        })
      ).result,
    ).toBe("throttled");
    // The owner, elsewhere, still gets a code straight away.
    expect(
      (
        await issue(catalog, "owner@example.com", {
          requester: "owner-home",
          now: T0 + 11 * HOUR,
        })
      ).result,
    ).toBe("sent");
  });

  it("caps an address across every network at fifty codes a day", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const results = [];
    for (
      let index = 0;
      index < SIGN_IN_POLICY.maxCodesPerAddressDay + 5;
      index += 1
    ) {
      results.push(
        (
          await issue(catalog, "member@example.com", {
            requester: `network-${index}`,
            now: T0 + index,
          })
        ).result,
      );
    }
    expect(results.filter((result) => result === "sent")).toHaveLength(
      SIGN_IN_POLICY.maxCodesPerAddressDay,
    );
    expect(results.at(-1)).toBe("throttled");
  });

  it("enforces the limits even when requests arrive at the same moment", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const burst = await Promise.all(
      Array.from({ length: 20 }, () => issue(catalog, "member@example.com")),
    );
    expect(burst.filter(({ result }) => result === "sent")).toHaveLength(1);
    expect(
      burst.reduce(
        (total, { deliver }) => total + deliver.mock.calls.length,
        0,
      ),
    ).toBe(1);
    expect(liveCodes(catalog)).toHaveLength(1);
  });

  it("lets a browser signed in as the address confirm even when its limits are used up", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "owner@example.com", "owner");
    for (
      let index = 0;
      index < SIGN_IN_POLICY.maxCodesPerAddressDay;
      index += 1
    ) {
      await issue(catalog, "owner@example.com", {
        requester: `attacker-${index}`,
        now: T0 + index,
      });
    }
    expect(
      (await issue(catalog, "owner@example.com", { now: T0 + MINUTE })).result,
    ).toBe("throttled");

    const confirm = await issue(catalog, "owner@example.com", {
      signedInAsAddress: true,
      now: T0 + MINUTE,
    });
    expect(confirm.result).toBe("sent");
    // It is still held to its own once-a-minute resend.
    expect(
      (
        await issue(catalog, "owner@example.com", {
          attemptId: confirm.attemptId,
          signedInAsAddress: true,
          now: T0 + MINUTE + 1_000,
        })
      ).result,
    ).toBe("throttled");
  });

  it("allows a new code at once when the last one is used up", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const first = await issue(catalog, "member@example.com");
    for (let index = 0; index < SIGN_IN_POLICY.maxAttemptsPerCode; index += 1) {
      await check(catalog, first.attemptId, wrongCode(first.code), T0 + 1_000);
    }
    const again = await issue(catalog, "member@example.com", {
      attemptId: first.attemptId,
      now: T0 + 2_000,
    });
    expect(again.result).toBe("sent");
    await expect(
      check(catalog, first.attemptId, again.code, T0 + 3_000),
    ).resolves.toEqual({ status: "valid", email: "member@example.com" });
  });

  it("reports a code the mail service did not accept", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const result = await issueSignInCode({
      database: catalog.database,
      secret,
      attemptId: randomToken(16),
      email: "member@example.com",
      requester: "network-a",
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
    await expect(check(catalog, attemptId, code)).resolves.toEqual({
      status: "valid",
      email: "member@example.com",
    });
    await expect(check(catalog, attemptId, code)).resolves.toEqual({
      status: "expired",
    });
  });

  it("allows five tries per code, then refuses even the right one", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { code, attemptId } = await issue(catalog, "member@example.com");
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
    const { code, attemptId } = await issue(catalog, "member@example.com");
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
    const { code } = await issue(catalog, "member@example.com");
    await expect(check(catalog, randomToken(16), code)).resolves.toEqual({
      status: "expired",
    });
  });

  it("expires after ten minutes", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const { code, attemptId } = await issue(catalog, "member@example.com");
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
    expect(liveCodes(catalog)).toHaveLength(1);
    if (first.code !== second.code) {
      await expect(
        check(catalog, first.attemptId, first.code, T0 + 62_000),
      ).resolves.toEqual({ status: "wrong" });
    }
    await expect(
      check(catalog, first.attemptId, second.code, T0 + 62_000),
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
    await expect(check(catalog, first.attemptId, first.code)).resolves.toEqual({
      status: "valid",
      email: "member@example.com",
    });
  });

  it("kills the address's other outstanding codes once one is used", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const laptop = await issue(catalog, "member@example.com");
    const phone = await issue(catalog, "member@example.com", {
      requester: "network-b",
    });
    await expect(
      check(catalog, phone.attemptId, phone.code, T0 + 2_000),
    ).resolves.toMatchObject({ status: "valid" });
    await expect(
      check(catalog, laptop.attemptId, laptop.code, T0 + 2_000),
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
    const token = await signIn(catalog, "member@example.com");
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

  it("are never created for a member whose access was turned off", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "off@example.com", "editor", "disabled");
    await expect(
      startSession({
        database: catalog.database,
        email: "off@example.com",
        now: T0,
      }),
    ).resolves.toBeNull();
    await expect(
      startSession({
        database: catalog.database,
        email: "who@example.com",
        now: T0,
      }),
    ).resolves.toBeNull();
    expect(catalog.rows("SELECT * FROM admin_sessions")).toEqual([]);
    expect(catalog.rows("SELECT * FROM audit_log")).toEqual([]);
  });

  it("expire after seven days and ignore malformed tokens", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    const token = await signIn(catalog, "member@example.com");
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
    const old = await signIn(catalog, "member@example.com");
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
      readSession(catalog.database, fresh ?? "", T0 + MINUTE),
    ).resolves.toMatchObject({ email: "member@example.com" });
    expect(catalog.rows("SELECT id FROM admin_sign_in_codes")).toEqual([]);
  });

  it("end one at a time, or every one for the token's owner", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "member@example.com");
    addMember(catalog, "other@example.com");
    const first = await signIn(catalog, "member@example.com", T0);
    const second = await signIn(catalog, "member@example.com", T0 + 1);
    const third = await signIn(catalog, "member@example.com", T0 + 2);
    const someoneElse = await signIn(catalog, "other@example.com", T0 + 3);

    await endSession(catalog.database, first);
    await expect(
      readSession(catalog.database, first, T0 + 4),
    ).resolves.toBeNull();
    await expect(
      readSession(catalog.database, second, T0 + 4),
    ).resolves.not.toBeNull();

    await expect(
      endEverySession(catalog.database, second, T0 + 4),
    ).resolves.toBe(2);
    await expect(
      readSession(catalog.database, third, T0 + 4),
    ).resolves.toBeNull();
    await expect(
      readSession(catalog.database, someoneElse, T0 + 4),
    ).resolves.not.toBeNull();

    // A token that is not a live session proves nothing and ends nothing.
    await expect(
      endEverySession(catalog.database, second, T0 + 4),
    ).resolves.toBe(0);
    await expect(
      endEverySession(catalog.database, randomToken(32), T0 + 4),
    ).resolves.toBe(0);
    await expect(
      endEverySession(catalog.database, "nope", T0 + 4),
    ).resolves.toBe(0);
    await expect(
      readSession(catalog.database, someoneElse, T0 + 4),
    ).resolves.not.toBeNull();
  });

  it("count as fresh for team changes for two hours after a code", () => {
    expect(isFreshSession({ verifiedAt: T0 }, T0 + 119 * MINUTE)).toBe(true);
    expect(isFreshSession({ verifiedAt: T0 }, T0 + 120 * MINUTE)).toBe(false);
  });
});

describe("the code key", () => {
  it("uses the deployed key and falls back only in local development", () => {
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
