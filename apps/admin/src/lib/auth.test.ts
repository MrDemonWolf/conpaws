import { beforeEach, describe, expect, it, vi } from "vitest";

const { headersMock, bindingsMock, databaseMock, jwtVerifyMock } = vi.hoisted(
  () => ({
    headersMock: vi.fn(),
    bindingsMock: vi.fn(),
    databaseMock: vi.fn(),
    jwtVerifyMock: vi.fn(),
  }),
);

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: jwtVerifyMock,
}));
vi.mock("./db", () => ({
  getAdminBindings: bindingsMock,
  getCatalogDatabase: databaseMock,
}));

import { getAdminGate, requireAdmin } from "./auth";

type Member = { role: "owner" | "editor"; status: "active" | "disabled" };

/**
 * A stand-in catalog that honours the owner claim the way D1 does: the
 * INSERT only lands while no owner exists.
 */
function ownershipDatabase(initial: Array<[string, Member]> = []) {
  const members = new Map<string, Member>(initial);
  const claims: string[] = [];
  const queries: string[] = [];
  const db = {
    prepare: vi.fn((query: string) => {
      queries.push(query);
      return {
        bind: vi.fn((email: string) => ({
          run: async () => {
            const hasOwner = [...members.values()].some(
              (member) => member.role === "owner",
            );
            if (query.includes("INSERT OR IGNORE") && !hasOwner) {
              claims.push(email);
              members.set(email, { role: "owner", status: "active" });
            }
            return { success: true };
          },
          first: async () => members.get(email) ?? null,
        })),
      };
    }),
  };
  return { db, claims, queries };
}

function setup({
  runtime = "production",
  devEmail,
  bootstrapEmails,
  member,
}: {
  runtime?: "local" | "production";
  devEmail?: string;
  bootstrapEmails?: string;
  member?: { role: "owner" | "editor"; status: "active" | "disabled" } | null;
} = {}) {
  const sql: string[] = [];
  const run = vi.fn(async () => ({ success: true }));
  const first = vi.fn(async () => member ?? null);
  const db = {
    prepare: vi.fn((query: string) => {
      sql.push(query);
      return { bind: vi.fn(() => ({ run, first })) };
    }),
  };
  bindingsMock.mockResolvedValue({
    CATALOG_DB: {},
    ADMIN_RUNTIME_ENV: runtime,
    ADMIN_DEV_EMAIL: devEmail,
    ADMIN_BOOTSTRAP_EMAILS: bootstrapEmails,
    CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
    CF_ACCESS_AUD: "audience",
  });
  databaseMock.mockResolvedValue(db);
  headersMock.mockResolvedValue(new Headers());
  jwtVerifyMock.mockResolvedValue({ payload: { email: "User@Example.com" } });
  return { db, sql, run, first };
}

describe("admin authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an identity when no Access token or local identity exists", async () => {
    setup();
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
  });

  it("rejects an unknown email as not provisioned", async () => {
    setup();
    headersMock.mockResolvedValue(
      new Headers({ "cf-access-jwt-assertion": "signed-token" }),
    );
    await expect(getAdminGate()).resolves.toEqual({
      status: "not-provisioned",
      email: "user@example.com",
    });
  });

  it("rejects a disabled member", async () => {
    setup({ member: { role: "editor", status: "disabled" } });
    headersMock.mockResolvedValue(
      new Headers({ "cf-access-jwt-assertion": "signed-token" }),
    );
    await expect(getAdminGate()).resolves.toEqual({
      status: "disabled",
      email: "user@example.com",
    });
  });

  it("denies an editor when owner access is required", async () => {
    setup({ member: { role: "editor", status: "active" } });
    headersMock.mockResolvedValue(
      new Headers({ "cf-access-jwt-assertion": "signed-token" }),
    );
    await expect(requireAdmin("owner")).rejects.toThrow(
      "Admin access denied: owner role required",
    );
  });

  it("makes the first allowed person to sign in the owner, once", async () => {
    const catalog = ownershipDatabase();
    bindingsMock.mockResolvedValue({
      CATALOG_DB: {},
      ADMIN_RUNTIME_ENV: "production",
      ADMIN_BOOTSTRAP_EMAILS: " other@example.com, User@Example.com ",
      CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      CF_ACCESS_AUD: "audience",
    });
    databaseMock.mockResolvedValue(catalog.db);
    headersMock.mockResolvedValue(
      new Headers({ "cf-access-jwt-assertion": "signed-token" }),
    );
    jwtVerifyMock.mockResolvedValue({ payload: { email: "User@Example.com" } });

    await expect(getAdminGate()).resolves.toEqual({
      status: "authorized",
      session: { email: "user@example.com", role: "owner" },
    });
    expect(catalog.claims).toEqual(["user@example.com"]);
    expect(catalog.queries[0]).toContain(
      "NOT EXISTS (SELECT 1 FROM admin_members WHERE role = 'owner')",
    );

    // A second allowed person arriving later finds the owner already taken.
    jwtVerifyMock.mockResolvedValue({
      payload: { email: "other@example.com" },
    });
    await expect(getAdminGate()).resolves.toEqual({
      status: "not-provisioned",
      email: "other@example.com",
    });
    expect(catalog.claims).toEqual(["user@example.com"]);
  });

  it("never lets someone outside the account claim an ownerless catalog", async () => {
    const catalog = ownershipDatabase();
    bindingsMock.mockResolvedValue({
      CATALOG_DB: {},
      ADMIN_RUNTIME_ENV: "production",
      ADMIN_BOOTSTRAP_EMAILS: "owner@example.com",
      CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
      CF_ACCESS_AUD: "audience",
    });
    databaseMock.mockResolvedValue(catalog.db);
    headersMock.mockResolvedValue(
      new Headers({ "cf-access-jwt-assertion": "signed-token" }),
    );
    jwtVerifyMock.mockResolvedValue({
      payload: { email: "stranger@example.com" },
    });

    await expect(getAdminGate()).resolves.toEqual({
      status: "not-provisioned",
      email: "stranger@example.com",
    });
    expect(catalog.claims).toEqual([]);
    expect(catalog.queries.some((query) => query.includes("INSERT"))).toBe(
      false,
    );
  });

  it("does not let the local dev identity claim a catalog that has an owner", async () => {
    const catalog = ownershipDatabase([
      ["existing@example.com", { role: "owner", status: "active" }],
    ]);
    bindingsMock.mockResolvedValue({
      CATALOG_DB: {},
      ADMIN_RUNTIME_ENV: "local",
      ADMIN_DEV_EMAIL: "bootstrap@example.com",
    });
    databaseMock.mockResolvedValue(catalog.db);
    headersMock.mockResolvedValue(new Headers());

    await expect(getAdminGate()).resolves.toEqual({
      status: "not-provisioned",
      email: "bootstrap@example.com",
    });
    expect(catalog.claims).toEqual([]);
  });

  it("uses the dev identity bypass only for the local runtime", async () => {
    setup({
      runtime: "local",
      devEmail: " Dev@Example.com ",
      member: { role: "editor", status: "active" },
    });
    await expect(getAdminGate()).resolves.toEqual({
      status: "authorized",
      session: { email: "dev@example.com", role: "editor" },
    });
    expect(jwtVerifyMock).not.toHaveBeenCalled();

    setup({ runtime: "production", devEmail: "dev@example.com" });
    await expect(getAdminGate()).resolves.toEqual({
      status: "identity-required",
    });
  });
});
