import { beforeEach, expect, it, vi } from "vitest";
import { unarchiveConvention } from "./convention-archive";

const { unarchive, reconcile, record, reportError } = vi.hoisted(() => ({
  unarchive: vi.fn(),
  reconcile: vi.fn(),
  record: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/db/repositories/conventions", () => ({ unarchive }));
vi.mock("./notifications", () => ({ reconcileEventReminders: reconcile }));
vi.mock("@/lib/reminder-notice", () => ({
  recordReminderReconciliation: record,
}));
vi.mock("@/lib/error-reporting", () => ({ reportError }));

const reconciliation = {
  rescheduled: 1,
  cleared: 0,
  paused: 0,
  overflow: 0,
  staleCancelled: 0,
};

beforeEach(() => {
  unarchive.mockReset().mockResolvedValue(undefined);
  reconcile.mockReset().mockResolvedValue(reconciliation);
  record.mockReset();
  reportError.mockReset();
});

it("re-arms the convention's saved reminders once it is unarchived", async () => {
  await unarchiveConvention("c1");

  expect(unarchive).toHaveBeenCalledWith("c1");
  // Archive cancelled the OS requests. Waiting for the next foreground to
  // re-arm them misses any reminder due before the user reopens the app.
  expect(reconcile).toHaveBeenCalledOnce();
  expect(unarchive.mock.invocationCallOrder[0]).toBeLessThan(
    reconcile.mock.invocationCallOrder[0],
  );
  expect(record).toHaveBeenCalledWith(reconciliation);
});

it("still unarchives when re-arming the reminders fails", async () => {
  const failure = new Error("notifications unavailable");
  reconcile.mockRejectedValue(failure);

  // The convention is already back, so the "could not unarchive" alert would
  // be wrong; the next foreground reconcile retries the reminders.
  await expect(unarchiveConvention("c1")).resolves.toBeUndefined();
  expect(reportError).toHaveBeenCalledWith(failure, {
    scope: "reminders.unarchive",
  });
  expect(record).not.toHaveBeenCalled();
});

it("leaves reminders alone when the convention could not be unarchived", async () => {
  unarchive.mockRejectedValue(new Error("disk full"));

  await expect(unarchiveConvention("c1")).rejects.toThrow("disk full");
  expect(reconcile).not.toHaveBeenCalled();
});
