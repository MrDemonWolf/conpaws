import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addInvite,
  addMember,
  createTestCatalog,
  type TestCatalog,
} from "../../test/d1-sqlite";
import { form, redirectOf } from "../../test/next-request";

const { requireAdminMock, databaseMock, bindingsMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  databaseMock: vi.fn(),
  bindingsMock: vi.fn(),
}));

vi.mock("../../lib/auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("../../lib/db", () => ({
  getCatalogDatabase: databaseMock,
  getAdminBindings: bindingsMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

import * as actions from "./actions";

describe("server action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockRejectedValue(
      new Error("Admin access denied: identity-required"),
    );
  });

  it("calls the authorization gate first in every exported action", async () => {
    const exportedActions = Object.entries(actions).filter(
      ([, action]) => typeof action === "function",
    );
    expect(exportedActions).toHaveLength(10);

    for (const [name, action] of exportedActions) {
      await expect(action(new FormData()), name).rejects.toThrow(
        "Admin access denied: identity-required",
      );
      expect(requireAdminMock, name).toHaveBeenCalledOnce();
      expect(databaseMock, name).not.toHaveBeenCalled();
      requireAdminMock.mockClear();
    }
  });

  it("requires a freshly confirmed owner for every team change", async () => {
    requireAdminMock.mockResolvedValue({
      email: "owner@example.com",
      role: "owner",
      verifiedAt: Date.now(),
    });
    databaseMock.mockResolvedValue(createTestCatalog().database);
    bindingsMock.mockResolvedValue({});
    for (const action of [
      actions.inviteAdmin,
      actions.resendAdminInvite,
      actions.revokeAdminInvite,
      actions.updateAdminRole,
    ]) {
      requireAdminMock.mockClear();
      await redirectOf(() => action(new FormData()));
      expect(requireAdminMock, action.name).toHaveBeenCalledWith("owner", {
        confirmAt: "/team",
      });
    }
  });
});

describe("team changes", () => {
  let catalog: TestCatalog;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    catalog = createTestCatalog();
    addMember(catalog, "owner@example.com", "owner");
    send = vi.fn(async () => ({ messageId: "m" }));
    requireAdminMock.mockResolvedValue({
      email: "owner@example.com",
      role: "owner",
      verifiedAt: Date.now(),
    });
    databaseMock.mockResolvedValue(catalog.database);
    bindingsMock.mockResolvedValue({
      ADMIN_RUNTIME_ENV: "production",
      ADMIN_PUBLIC_URL: "https://admin.conpaws.com",
      ADMIN_EMAIL_FROM: "admin@conpaws.com",
      ADMIN_EMAIL: { send },
    });
  });

  it("invites someone and emails them a sign-in link", async () => {
    await expect(
      redirectOf(() =>
        actions.inviteAdmin(form({ email: "New@Example.com", role: "editor" })),
      ),
    ).resolves.toBe("/team?saved=invite");
    expect(
      catalog.rows("SELECT email, role, invited_by FROM admin_invites"),
    ).toEqual([
      {
        email: "new@example.com",
        role: "editor",
        invited_by: "owner@example.com",
      },
    ]);
    expect(catalog.rows("SELECT action FROM audit_log")).toEqual([
      { action: "admin.invited" },
    ]);
    const message = send.mock.calls[0]?.[0] as { to: string; text: string };
    expect(message.to).toBe("new@example.com");
    // The address rides after `#`, so it never reaches the Worker's logs.
    expect(message.text).toContain(
      "https://admin.conpaws.com/sign-in#email=new%40example.com",
    );
    expect(message.text).not.toContain("?email=");
  });

  it("keeps the invite and says so when the email does not send", async () => {
    send.mockRejectedValue(Object.assign(new Error("x"), { code: "E_X" }));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    await expect(
      redirectOf(() =>
        actions.inviteAdmin(form({ email: "new@example.com", role: "editor" })),
      ),
    ).resolves.toBe("/team?saved=invite-unsent");
    expect(catalog.rows("SELECT email FROM admin_invites")).toHaveLength(1);
  });

  it("will not invite someone who is already on the team", async () => {
    addMember(catalog, "off@example.com", "editor", "disabled");
    await expect(
      redirectOf(() =>
        actions.inviteAdmin(form({ email: "off@example.com", role: "owner" })),
      ),
    ).resolves.toBe("/team?error=member");
    expect(catalog.rows("SELECT * FROM admin_invites")).toEqual([]);
    expect(catalog.rows("SELECT * FROM audit_log")).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a bad address or role", async () => {
    for (const values of [
      { email: "nope", role: "editor" },
      { email: "a@example.com", role: "admin" },
    ]) {
      await expect(
        redirectOf(() => actions.inviteAdmin(form(values))),
      ).resolves.toBe("/team?error=invalid");
    }
  });

  it("renews an invite when resending it", async () => {
    addInvite(catalog, "late@example.com", { role: "owner", expiresAt: 1 });
    await expect(
      redirectOf(() =>
        actions.resendAdminInvite(form({ email: "late@example.com" })),
      ),
    ).resolves.toBe("/team?saved=invite");
    const [invite] = catalog.rows<{ expires_at: number; role: string }>(
      "SELECT expires_at, role FROM admin_invites",
    );
    expect(invite?.role).toBe("owner");
    expect(invite?.expires_at).toBeGreaterThan(Date.now());
    expect(send).toHaveBeenCalledOnce();
    await expect(
      redirectOf(() =>
        actions.resendAdminInvite(form({ email: "gone@example.com" })),
      ),
    ).resolves.toBe("/team?error=invite-missing");
  });

  it("withdraws an invite and the codes already sent for it", async () => {
    addInvite(catalog, "new@example.com", { expiresAt: Date.now() + 60_000 });
    catalog.exec(
      "INSERT INTO admin_sign_in_codes (id, attempt_id, email, code_hash, created_at, expires_at) VALUES ('c', 'a', 'new@example.com', 'x', ?, ?)",
      Date.now(),
      Date.now() + 60_000,
    );
    await expect(
      redirectOf(() =>
        actions.revokeAdminInvite(form({ email: "new@example.com" })),
      ),
    ).resolves.toBe("/team?saved=revoked");
    expect(catalog.rows("SELECT * FROM admin_invites")).toEqual([]);
    expect(
      catalog.rows("SELECT consumed_at FROM admin_sign_in_codes")[0],
    ).toEqual({ consumed_at: expect.any(Number) });
    expect(catalog.rows("SELECT action FROM audit_log")).toEqual([
      { action: "admin.invite-revoked" },
    ]);
  });

  it("signs someone out everywhere when their access is turned off", async () => {
    addMember(catalog, "editor@example.com", "editor");
    catalog.exec(
      "INSERT INTO admin_sessions (token_hash, email, created_at, expires_at, verified_at) VALUES ('h1', 'editor@example.com', 0, ?, 0), ('h2', 'owner@example.com', 0, ?, 0)",
      Date.now() + 60_000,
      Date.now() + 60_000,
    );
    await expect(
      redirectOf(() =>
        actions.updateAdminRole(
          form({
            email: "editor@example.com",
            role: "editor",
            status: "disabled",
          }),
        ),
      ),
    ).resolves.toBe("/team?saved=role");
    expect(catalog.rows("SELECT email FROM admin_sessions")).toEqual([
      { email: "owner@example.com" },
    ]);
  });

  it("keeps sessions for a role change that leaves access on", async () => {
    addMember(catalog, "editor@example.com", "editor");
    catalog.exec(
      "INSERT INTO admin_sessions (token_hash, email, created_at, expires_at, verified_at) VALUES ('h1', 'editor@example.com', 0, ?, 0)",
      Date.now() + 60_000,
    );
    await redirectOf(() =>
      actions.updateAdminRole(
        form({ email: "editor@example.com", role: "owner", status: "active" }),
      ),
    );
    expect(catalog.rows("SELECT email FROM admin_sessions")).toHaveLength(1);
  });

  it("still protects the last active owner", async () => {
    await expect(
      redirectOf(() =>
        actions.updateAdminRole(
          form({
            email: "owner@example.com",
            role: "editor",
            status: "active",
          }),
        ),
      ),
    ).resolves.toBe("/team?error=self");
  });
});
