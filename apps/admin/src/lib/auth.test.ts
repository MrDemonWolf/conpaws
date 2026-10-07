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

function setup({
  runtime = "production",
  devEmail,
  ownerEmail,
  member,
}: {
  runtime?: "local" | "production";
  devEmail?: string;
  ownerEmail?: string;
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
    ADMIN_OWNER_EMAIL: ownerEmail,
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

  it("does not bootstrap the configured owner when an owner already exists", async () => {
    const state = new Map<
      string,
      { role: "owner" | "editor"; status: "active" | "disabled" }
    >();
    state.set("existing@example.com", { role: "owner", status: "active" });
    const insertRun = vi.fn(async (email: string) => {
      if (![...state.values()].some((value) => value.role === "owner")) {
        state.set(email, { role: "owner", status: "active" });
      }
    });
    const queries: string[] = [];
    bindingsMock.mockResolvedValue({
      CATALOG_DB: {},
      ADMIN_RUNTIME_ENV: "local",
      ADMIN_OWNER_EMAIL: "bootstrap@example.com",
      ADMIN_DEV_EMAIL: "bootstrap@example.com",
    });
    headersMock.mockResolvedValue(new Headers());
    databaseMock.mockResolvedValue({
      prepare: vi.fn((query: string) => {
        queries.push(query);
        return {
          bind: vi.fn((email: string) => ({
            run: () =>
              query.includes("NOT EXISTS") &&
              [...state.values()].some((value) => value.role === "owner")
                ? Promise.resolve()
                : insertRun(email),
            first: async () => state.get(email) ?? null,
          })),
        };
      }),
    });

    await expect(getAdminGate()).resolves.toEqual({
      status: "not-provisioned",
      email: "bootstrap@example.com",
    });
    expect(queries[0]).toContain(
      "NOT EXISTS (SELECT 1 FROM admin_members WHERE role = 'owner')",
    );
    expect(insertRun).not.toHaveBeenCalled();
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
