import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, databaseMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  databaseMock: vi.fn(),
}));

vi.mock("../../lib/auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("../../lib/db", () => ({ getCatalogDatabase: databaseMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
    expect(exportedActions).toHaveLength(8);

    for (const [name, action] of exportedActions) {
      await expect(action(new FormData()), name).rejects.toThrow(
        "Admin access denied: identity-required",
      );
      expect(requireAdminMock, name).toHaveBeenCalledOnce();
      expect(databaseMock, name).not.toHaveBeenCalled();
      requireAdminMock.mockClear();
    }
  });
});
