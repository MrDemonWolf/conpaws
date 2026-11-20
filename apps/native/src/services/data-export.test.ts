import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPage, getByConventionIdPage, shareAsync, write, hapticSuccess } =
  vi.hoisted(() => ({
    getPage: vi.fn(),
    getByConventionIdPage: vi.fn(),
    shareAsync: vi.fn(),
    write: vi.fn(),
    hapticSuccess: vi.fn(),
  }));
vi.mock("@/db/repositories/conventions", () => ({ getPage }));
vi.mock("@/db/repositories/events", () => ({ getByConventionIdPage }));
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
    write = write;
  },
  Paths: { cache: "cache" },
}));
vi.mock("@/services/haptics", () => ({ hapticSuccess }));

import { exportAllData, triggerExport } from "./data-export";

describe("triggerExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPage.mockResolvedValue([{ id: "con-1" }]);
    getByConventionIdPage.mockResolvedValue([
      { description: "x".repeat(8 * 1024 * 1024) },
    ]);
    // expo-file-system 58 made File.write asynchronous.
    write.mockResolvedValue(undefined);
  });

  it("refuses a backup larger than the restore limit", async () => {
    await expect(triggerExport()).rejects.toThrow(/maximum restorable backup/);
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it("waits for the backup file write before opening the share sheet", async () => {
    getByConventionIdPage.mockResolvedValue([{ id: "event-1" }]);
    let finishWrite = () => {};
    write.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );

    const exporting = triggerExport();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shareAsync).not.toHaveBeenCalled();
    expect(hapticSuccess).not.toHaveBeenCalled();

    finishWrite();
    await exporting;

    expect(shareAsync).toHaveBeenCalledTimes(1);
    expect(hapticSuccess).toHaveBeenCalledTimes(1);
  });

  it("rejects without sharing when the backup file write fails", async () => {
    getByConventionIdPage.mockResolvedValue([{ id: "event-1" }]);
    write.mockRejectedValue(new Error("ENOSPC"));

    await expect(triggerExport()).rejects.toThrow("ENOSPC");
    expect(shareAsync).not.toHaveBeenCalled();
    expect(hapticSuccess).not.toHaveBeenCalled();
  });

  it("pages through convention and event rows when exporting", async () => {
    getPage
      .mockResolvedValueOnce(
        Array.from({ length: 25 }, (_, index) => ({ id: `con-${index}` })),
      )
      .mockResolvedValueOnce([{ id: "con-25" }]);
    getByConventionIdPage.mockResolvedValue([{ id: "event-1" }]);

    const payload = await exportAllData();

    expect(payload.data.conventions).toHaveLength(26);
    expect(payload.data.events).toHaveLength(26);
    expect(getPage).toHaveBeenNthCalledWith(1, 25, 0);
    expect(getPage).toHaveBeenNthCalledWith(2, 25, 25);
    expect(getByConventionIdPage).toHaveBeenCalledWith("con-0", 25, 0);
  });
});
