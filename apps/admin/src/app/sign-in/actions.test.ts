import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addInvite,
  addMember,
  createTestCatalog,
  type TestCatalog,
} from "../../test/d1-sqlite";
import {
  createRequestState,
  form,
  type RequestState,
  redirectOf,
} from "../../test/next-request";

const request = vi.hoisted(() => ({ current: null as RequestState | null }));

vi.mock("next/headers", () => ({
  cookies: async () => request.current?.cookies,
  headers: async () => request.current?.headers,
}));
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => request.current?.context(),
}));

import { getAdminGate } from "../../lib/auth";
import {
  requestSignInCode,
  signOut,
  signOutEverywhere,
  verifySignInCode,
} from "./actions";

const SESSION = "__Host-conpaws_admin_session";
const ATTEMPT = "__Host-conpaws_admin_sign_in";

let catalog: TestCatalog;
let state: RequestState;
let send: ReturnType<typeof vi.fn>;
let limit: ReturnType<typeof vi.fn>;

function setup(env: Record<string, unknown> = {}) {
  catalog = createTestCatalog();
  state = createRequestState();
  send = vi.fn(async () => ({ messageId: "m" }));
  limit = vi.fn(async () => ({ success: true }));
  state.env = {
    CATALOG_DB: catalog.database,
    ADMIN_RUNTIME_ENV: "production",
    ADMIN_AUTH_SECRET: "k".repeat(64),
    ADMIN_EMAIL_FROM: "admin@conpaws.com",
    ADMIN_EMAIL: { send },
    ADMIN_SIGN_IN_LIMITER: { limit },
    ...env,
  };
  request.current = state;
}

/** The code from the last email sent, as the person would read it. */
function lastCode() {
  const message = send.mock.calls.at(-1)?.[0] as { text: string } | undefined;
  const match = message?.text.match(/\b(\d{4})-(\d{4})\b/);
  if (!match) throw new Error("No code was emailed.");
  return `${match[1]}-${match[2]}`;
}

async function askForCode(email: string, extra: Record<string, string> = {}) {
  const destination = await redirectOf(() =>
    requestSignInCode(form({ email, ...extra })),
  );
  await state.settle();
  return destination;
}

describe("asking for a code", () => {
  beforeEach(() => setup());

  it("looks exactly the same for a member and a stranger", async () => {
    addMember(catalog, "member@example.com");
    const forMember = await askForCode("Member@Example.com");
    const memberCookie = state.writes.get(ATTEMPT);

    state.jar.clear();
    // Same length as the member's address: the cookie carries what was typed.
    const forStranger = await askForCode("nobody@example.com");
    const strangerCookie = state.writes.get(ATTEMPT);

    expect(forMember).toBe("/sign-in/code");
    expect(forStranger).toBe(forMember);
    expect(strangerCookie?.options).toEqual(memberCookie?.options);
    expect(strangerCookie?.value).toHaveLength(memberCookie?.value.length ?? 0);
    // Only the member was emailed, and only after the response.
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "member@example.com",
      from: { email: "admin@conpaws.com" },
    });
  });

  it("sets a strict browser-bound attempt cookie", async () => {
    addMember(catalog, "member@example.com");
    await askForCode("member@example.com");
    expect(state.writes.get(ATTEMPT)?.options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 1800,
    });
  });

  it("rejects a malformed address before doing anything", async () => {
    await expect(askForCode("not-an-email")).resolves.toBe(
      "/sign-in?error=email",
    );
    expect(limit).not.toHaveBeenCalled();
    expect(state.writes.size).toBe(0);
  });

  it("stops at the network limit without touching the database", async () => {
    addMember(catalog, "member@example.com");
    limit.mockResolvedValue({ success: false });
    await expect(askForCode("member@example.com")).resolves.toBe(
      "/sign-in?error=rate",
    );
    expect(limit).toHaveBeenCalledWith({ key: "request:203.0.113.7" });
    expect(send).not.toHaveBeenCalled();
    expect(catalog.rows("SELECT * FROM admin_sign_in_codes")).toEqual([]);
  });

  it("fails closed in production without the code key", async () => {
    setup({ ADMIN_AUTH_SECRET: undefined });
    await expect(askForCode("member@example.com")).resolves.toBe(
      "/sign-in?error=unavailable",
    );
  });

  it("logs a failed send without the address or the code", async () => {
    addMember(catalog, "member@example.com");
    const error = Object.assign(new Error("nope"), {
      code: "E_SENDER_DOMAIN_NOT_AVAILABLE",
    });
    send.mockRejectedValue(error);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await askForCode("member@example.com");
    const output = JSON.stringify([...logged.mock.calls, ...info.mock.calls]);
    expect(output).toContain("E_SENDER_DOMAIN_NOT_AVAILABLE");
    expect(output).not.toContain("member@example.com");
    expect(output).not.toMatch(/\d{4}-\d{4}/);
    logged.mockRestore();
    info.mockRestore();
  });
});

describe("entering the code", () => {
  beforeEach(() => setup());

  it("signs a member in with a secure seven-day session", async () => {
    addMember(catalog, "member@example.com", "owner");
    await askForCode("member@example.com");
    await expect(
      redirectOf(() => verifySignInCode(form({ code: lastCode() }))),
    ).resolves.toBe("/");

    const session = state.writes.get(SESSION);
    expect(session?.options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    expect(state.jar.has(ATTEMPT)).toBe(false);
    await expect(getAdminGate()).resolves.toMatchObject({
      status: "authorized",
      session: { email: "member@example.com", role: "owner" },
    });
  });

  it("returns to a same-site page and ignores anywhere else", async () => {
    addMember(catalog, "member@example.com");
    await askForCode("member@example.com", {
      next: "/conventions?status=draft",
    });
    await expect(
      redirectOf(() => verifySignInCode(form({ code: lastCode() }))),
    ).resolves.toBe("/conventions?status=draft");

    for (const next of ["//evil.example", "https://evil.example", "/\\evil"]) {
      setup();
      addMember(catalog, "member@example.com");
      await askForCode("member@example.com", { next });
      await expect(
        redirectOf(() => verifySignInCode(form({ code: lastCode() }))),
        next,
      ).resolves.toBe("/");
    }
  });

  it("turns an invite into a membership on first sign-in", async () => {
    addInvite(catalog, "new@example.com", {
      role: "editor",
      expiresAt: Date.now() + 60_000,
    });
    await askForCode("new@example.com");
    await redirectOf(() => verifySignInCode(form({ code: lastCode() })));
    expect(
      catalog.rows("SELECT email, role, status FROM admin_members"),
    ).toEqual([{ email: "new@example.com", role: "editor", status: "active" }]);
    await expect(getAdminGate()).resolves.toMatchObject({
      status: "authorized",
    });
  });

  it("explains a wrong code and keeps the attempt", async () => {
    addMember(catalog, "member@example.com");
    await askForCode("member@example.com");
    const wrong = lastCode().replace(/^\d/, (digit) =>
      String((Number(digit) + 1) % 10),
    );
    await expect(
      redirectOf(() => verifySignInCode(form({ code: wrong }))),
    ).resolves.toBe("/sign-in/code?error=wrong");
    await expect(
      redirectOf(() => verifySignInCode(form({ code: "12" }))),
    ).resolves.toBe("/sign-in/code?error=format");
    expect(state.jar.has(ATTEMPT)).toBe(true);
    expect(state.jar.has(SESSION)).toBe(false);
  });

  it("needs the browser that asked for the code", async () => {
    addMember(catalog, "member@example.com");
    await askForCode("member@example.com");
    const code = lastCode();
    state.jar.clear();
    await expect(
      redirectOf(() => verifySignInCode(form({ code }))),
    ).resolves.toBe("/sign-in?error=expired");
  });

  it("refuses an address whose access was turned off after the code was sent", async () => {
    addMember(catalog, "member@example.com");
    await askForCode("member@example.com");
    catalog.exec("UPDATE admin_members SET status = 'disabled'");
    await expect(
      redirectOf(() => verifySignInCode(form({ code: lastCode() }))),
    ).resolves.toBe("/sign-in?error=disabled");
    expect(state.jar.has(SESSION)).toBe(false);
  });

  it("refuses an invite withdrawn after the code was sent", async () => {
    addInvite(catalog, "new@example.com", { expiresAt: Date.now() + 60_000 });
    await askForCode("new@example.com");
    catalog.exec("DELETE FROM admin_invites");
    await expect(
      redirectOf(() => verifySignInCode(form({ code: lastCode() }))),
    ).resolves.toBe("/sign-in?error=denied");
    expect(catalog.rows("SELECT * FROM admin_members")).toEqual([]);
  });

  it("keeps the same attempt for a resend to the same address", async () => {
    addMember(catalog, "member@example.com");
    await askForCode("member@example.com");
    const first = state.jar.get(ATTEMPT);
    const code = lastCode();
    await expect(
      askForCode("member@example.com", { resend: "1" }),
    ).resolves.toBe("/sign-in/code?resent=1");
    expect(state.jar.get(ATTEMPT)).toBe(first);
    // The resend was inside the cooldown, so the first code still works.
    expect(send).toHaveBeenCalledOnce();
    await expect(
      redirectOf(() => verifySignInCode(form({ code }))),
    ).resolves.toBe("/");
  });
});

describe("signing out", () => {
  beforeEach(() => setup());

  async function signIn(email: string) {
    await askForCode(email);
    await redirectOf(() => verifySignInCode(form({ code: lastCode() })));
    return state.jar.get(SESSION) as string;
  }

  it("ends this browser's session", async () => {
    addMember(catalog, "member@example.com");
    await signIn("member@example.com");
    await expect(redirectOf(() => signOut())).resolves.toBe(
      "/sign-in?signed-out=1",
    );
    expect(state.writes.get(SESSION)?.options).toMatchObject({
      maxAge: 0,
      secure: true,
      path: "/",
    });
    expect(catalog.rows("SELECT * FROM admin_sessions")).toEqual([]);
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
  });

  it("ends every session for the address", async () => {
    addMember(catalog, "member@example.com");
    const first = await signIn("member@example.com");
    // A second device signs in a minute later.
    state.jar.clear();
    vi.setSystemTime(Date.now() + 61_000);
    await signIn("member@example.com");
    vi.useRealTimers();
    expect(catalog.rows("SELECT * FROM admin_sessions")).toHaveLength(2);
    await expect(redirectOf(() => signOutEverywhere())).resolves.toBe(
      "/sign-in?signed-out=all",
    );
    expect(catalog.rows("SELECT * FROM admin_sessions")).toEqual([]);
    state.jar.set(SESSION, first);
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
  });
});

describe("local development", () => {
  it("prints the code instead of relying on email, and only locally", async () => {
    setup({
      ADMIN_RUNTIME_ENV: "local",
      ADMIN_AUTH_SECRET: undefined,
      ADMIN_EMAIL: undefined,
    });
    addMember(catalog, "member@example.com");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await askForCode("member@example.com");
    const printed = String(info.mock.calls[0]?.[0] ?? "");
    expect(printed).toMatch(/\[local only\].*\d{4}-\d{4}/);
    info.mockRestore();

    const code = printed.match(/\d{4}-\d{4}/)?.[0] ?? "";
    await expect(
      redirectOf(() => verifySignInCode(form({ code }))),
    ).resolves.toBe("/");
    // Plain-HTTP localhost gets cookies without the Secure-only prefix.
    expect(state.jar.has("conpaws_admin_session")).toBe(true);
    expect(state.writes.get("conpaws_admin_session")?.options).toMatchObject({
      secure: false,
    });
  });
});
