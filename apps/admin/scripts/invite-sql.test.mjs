import { describe, expect, it } from "vitest";
import { addMember, createTestCatalog } from "../src/test/d1-sqlite";
import {
  INVITE_LIFETIME_MS,
  INVITED_BY,
  inviteSql,
  isInviteEmail,
  parseInviteArgs,
} from "./invite-sql.mjs";

const NOW = Date.UTC(2026, 9, 10);
const ID = "00000000-0000-4000-8000-000000000000";

/** Runs the SQL the way `wrangler d1 execute --local` does: one batch. */
async function execute(catalog, sql) {
  const statements = sql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => catalog.database.prepare(statement));
  const results = await catalog.database.batch(statements);
  return results.at(-1)?.results?.[0];
}

describe("admin:invite arguments", () => {
  it("default to inviting an owner in production", () => {
    expect(parseInviteArgs(["You@Example.com"])).toEqual({
      email: "you@example.com",
      role: "owner",
      local: false,
      persistTo: ".wrangler/state",
    });
    expect(
      parseInviteArgs(["a@example.com", "--role", "editor", "--local"]),
    ).toEqual({
      email: "a@example.com",
      role: "editor",
      local: true,
      persistTo: ".wrangler/state",
    });
    expect(
      parseInviteArgs(["a@example.com", "--local", "--persist-to", "/tmp/s"]),
    ).toMatchObject({ local: true, persistTo: "/tmp/s" });
    expect(
      parseInviteArgs(["a@example.com", "--persist-to", "--local"]),
    ).toHaveProperty("error");
    expect(parseInviteArgs(["--role=editor", "a@example.com"])).toMatchObject({
      role: "editor",
    });
    expect(parseInviteArgs(["--help"])).toEqual({ help: true });
  });

  it("refuse anything that is not a plain address or a known role", () => {
    expect(parseInviteArgs([])).toHaveProperty("error");
    expect(
      parseInviteArgs(["a@example.com", "--role", "admin"]),
    ).toHaveProperty("error");
    expect(parseInviteArgs(["a@example.com", "b@example.com"])).toHaveProperty(
      "error",
    );
    for (const bad of [
      "a@example.com; DROP TABLE admin_members",
      "a@example.com'--",
      'a"b@example.com',
      "a b@example.com",
      "a@example",
      ".a@example.com",
      "a..b@example.com",
    ]) {
      expect(isInviteEmail(bad), bad).toBe(false);
    }
    expect(isInviteEmail("o'brien+staff@sub.example.org")).toBe(true);
  });
});

describe("admin:invite SQL", () => {
  it("creates an invite and an audit entry", async () => {
    const catalog = createTestCatalog();
    const outcome = await execute(
      catalog,
      inviteSql({ email: "you@example.com", role: "owner", now: NOW, id: ID }),
    );
    expect(outcome).toEqual({ member_status: null, invite_role: "owner" });
    expect(catalog.rows("SELECT * FROM admin_invites")).toEqual([
      {
        email: "you@example.com",
        role: "owner",
        invited_by: INVITED_BY,
        created_at: NOW,
        expires_at: NOW + INVITE_LIFETIME_MS,
      },
    ]);
    expect(catalog.rows("SELECT actor_email, action FROM audit_log")).toEqual([
      { actor_email: INVITED_BY, action: "admin.invited" },
    ]);
  });

  it("renews an existing invite with the new role", async () => {
    const catalog = createTestCatalog();
    await execute(
      catalog,
      inviteSql({ email: "you@example.com", role: "editor", now: NOW, id: ID }),
    );
    const outcome = await execute(
      catalog,
      inviteSql({
        email: "you@example.com",
        role: "owner",
        now: NOW + 1,
        id: "00000000-0000-4000-8000-000000000001",
      }),
    );
    expect(outcome).toEqual({ member_status: null, invite_role: "owner" });
    expect(catalog.rows("SELECT * FROM audit_log")).toHaveLength(2);
  });

  it("leaves existing members alone, including disabled ones", async () => {
    const catalog = createTestCatalog();
    addMember(catalog, "off@example.com", "editor", "disabled");
    const outcome = await execute(
      catalog,
      inviteSql({ email: "off@example.com", role: "owner", now: NOW, id: ID }),
    );
    expect(outcome).toEqual({ member_status: "disabled", invite_role: null });
    expect(catalog.rows("SELECT * FROM admin_invites")).toEqual([]);
    expect(catalog.rows("SELECT * FROM audit_log")).toEqual([]);
  });

  it("quotes an apostrophe instead of ending the string", async () => {
    const catalog = createTestCatalog();
    await execute(
      catalog,
      inviteSql({
        email: "o'brien@example.com",
        role: "editor",
        now: NOW,
        id: ID,
      }),
    );
    expect(catalog.rows("SELECT email FROM admin_invites")).toEqual([
      { email: "o'brien@example.com" },
    ]);
  });

  it("refuses to build SQL from unchecked input", () => {
    expect(() =>
      inviteSql({
        email: "x'); DROP TABLE x;--@a.com",
        role: "owner",
        now: NOW,
        id: ID,
      }),
    ).toThrow();
    expect(() =>
      inviteSql({ email: "a@example.com", role: "root", now: NOW, id: ID }),
    ).toThrow();
    expect(() =>
      inviteSql({
        email: "a@example.com",
        role: "owner",
        now: NOW,
        id: "x' OR 1",
      }),
    ).toThrow();
  });
});
