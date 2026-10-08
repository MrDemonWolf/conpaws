import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAll, getByConventionId, shareAsync } = vi.hoisted(() => ({
  getAll: vi.fn(),
  getByConventionId: vi.fn(),
  shareAsync: vi.fn(),
}));
vi.mock("@/db/repositories/conventions", () => ({ getAll }));
vi.mock("@/db/repositories/events", () => ({ getByConventionId }));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: async () => true,
  shareAsync,
}));
vi.mock("expo-file-system", () => ({
  Directory: class {
    exists = false;
    list() {
      return [];
    }
  },
  File: class {
    write = vi.fn();
  },
  Paths: { cache: "cache" },
}));
vi.mock("@/services/haptics", () => ({ hapticSuccess: vi.fn() }));

import { triggerExport } from "./data-export";

describe("triggerExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAll.mockResolvedValue([{ id: "con-1" }]);
    getByConventionId.mockResolvedValue([
      { description: "x".repeat(8 * 1024 * 1024) },
    ]);
  });

  it("refuses a backup larger than the restore limit", async () => {
    await expect(triggerExport()).rejects.toThrow(/maximum restorable backup/);
    expect(shareAsync).not.toHaveBeenCalled();
  });
});
