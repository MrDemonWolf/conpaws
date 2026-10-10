import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMember,
  createTestCatalog,
  type TestCatalog,
} from "../test/d1-sqlite";
import {
  createRequestState,
  type RequestState,
  redirectOf,
} from "../test/next-request";

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

import { getAdminGate, requireAdmin } from "./auth";
import { SIGN_IN_POLICY, startSession } from "./sign-in";

const SESSION = "__Host-conpaws_admin_session";
let catalog: TestCatalog;
let state: RequestState;

function setup(env: Record<string, unknown> = {}) {
  catalog = createTestCatalog();
  state = createRequestState();
  state.env = {
    CATALOG_DB: catalog.database,
    ADMIN_RUNTIME_ENV: "production",
    ...env,
  };
  request.current = state;
}

async function signedIn(
  email: string,
  role: "owner" | "editor" = "editor",
  verifiedAgoMs = 0,
) {
  addMember(catalog, email, role);
  const token = await startSession({
    database: catalog.database,
    email,
    now: Date.now() - verifiedAgoMs,
  });
  state.jar.set(SESSION, token);
  return token;
}

describe("the admin gate", () => {
  beforeEach(() => setup());

  it("asks a visitor without a session to sign in", async () => {
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
    state.jar.set(SESSION, "forged-or-stale");
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
  });

  it("lets a signed-in member through with their role", async () => {
    await signedIn("editor@example.com");
    await expect(getAdminGate()).resolves.toEqual({
      status: "authorized",
      session: {
        email: "editor@example.com",
        role: "editor",
        verifiedAt: expect.any(Number),
      },
    });
  });

  it("follows role changes on the next request", async () => {
    await signedIn("person@example.com", "editor");
    catalog.exec("UPDATE admin_members SET role = 'owner'");
    await expect(getAdminGate()).resolves.toMatchObject({
      session: { role: "owner" },
    });
  });

  it("refuses a disabled member even with a live session", async () => {
    await signedIn("off@example.com");
    catalog.exec("UPDATE admin_members SET status = 'disabled'");
    await expect(getAdminGate()).resolves.toEqual({
      status: "disabled",
      email: "off@example.com",
    });
  });

  it("ignores a session older than seven days", async () => {
    await signedIn(
      "member@example.com",
      "editor",
      SIGN_IN_POLICY.sessionLifetimeMs,
    );
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
  });

  it("does not accept the local cookie name in production", async () => {
    const token = await signedIn("member@example.com");
    state.jar.clear();
    state.jar.set("conpaws_admin_session", token);
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
  });

  it("reports an unreachable or unmigrated database as unavailable", async () => {
    setup({ CATALOG_DB: undefined });
    await expect(getAdminGate()).resolves.toEqual({ status: "unavailable" });

    setup();
    const token = await signedIn("member@example.com");
    catalog.sqlite.exec("DROP TABLE admin_sessions");
    state.jar.set(SESSION, token);
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    await expect(getAdminGate()).resolves.toEqual({ status: "unavailable" });
  });
});

describe("requireAdmin", () => {
  beforeEach(() => setup());

  it("sends a signed-out visitor to sign in", async () => {
    await expect(redirectOf(() => requireAdmin())).resolves.toBe("/sign-in");
  });

  it("refuses an editor where an owner is required", async () => {
    await signedIn("editor@example.com", "editor");
    await expect(requireAdmin("owner")).rejects.toThrow(
      "Admin access denied: owner role required",
    );
  });

  it("asks an owner to confirm with a fresh code before team changes", async () => {
    await signedIn("owner@example.com", "owner", SIGN_IN_POLICY.freshSessionMs);
    await expect(requireAdmin("owner")).resolves.toMatchObject({
      email: "owner@example.com",
    });
    await expect(
      redirectOf(() => requireAdmin("owner", { confirmAt: "/team" })),
    ).resolves.toBe("/team?confirm=required");
  });

  it("lets a freshly verified owner change the team", async () => {
    await signedIn("owner@example.com", "owner", 60_000);
    await expect(
      requireAdmin("owner", { confirmAt: "/team" }),
    ).resolves.toMatchObject({ email: "owner@example.com", role: "owner" });
  });
});

describe("the local development shortcut", () => {
  it("acts as the dev address and claims an ownerless local catalog once", async () => {
    setup({ ADMIN_RUNTIME_ENV: "local", ADMIN_DEV_EMAIL: " Dev@Example.com " });
    await expect(getAdminGate()).resolves.toMatchObject({
      status: "authorized",
      session: { email: "dev@example.com", role: "owner" },
    });
    await getAdminGate();
    expect(catalog.rows("SELECT email, role FROM admin_members")).toEqual([
      { email: "dev@example.com", role: "owner" },
    ]);
  });

  it("does not take over a local catalog that already has an owner", async () => {
    setup({ ADMIN_RUNTIME_ENV: "local", ADMIN_DEV_EMAIL: "dev@example.com" });
    addMember(catalog, "existing@example.com", "owner");
    await expect(getAdminGate()).resolves.toEqual({
      status: "not-provisioned",
      email: "dev@example.com",
    });
  });

  it("does nothing outside the local runtime", async () => {
    for (const runtime of ["production", undefined]) {
      setup({ ADMIN_RUNTIME_ENV: runtime, ADMIN_DEV_EMAIL: "dev@example.com" });
      await expect(getAdminGate(), String(runtime)).resolves.toEqual({
        status: "identity-required",
      });
      expect(catalog.rows("SELECT * FROM admin_members")).toEqual([]);
    }
  });
});
