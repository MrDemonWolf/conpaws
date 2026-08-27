import { beforeEach, describe, expect, it } from "vitest";
import {
  getReminderReconciliation,
  recordReminderReconciliation,
  resolveReminderNotice,
} from "./reminder-notice";

describe("resolveReminderNotice", () => {
  it("says nothing when no visible row carries a reminder", () => {
    expect(
      resolveReminderNotice({
        permission: "denied",
        reminderCount: 0,
        overflow: 3,
      }),
    ).toBe("none");
  });

  it("stays quiet while the permission status is still unknown", () => {
    expect(
      resolveReminderNotice({
        permission: null,
        reminderCount: 2,
        overflow: 0,
      }),
    ).toBe("none");
  });

  it("reports paused reminders when permission is not granted", () => {
    expect(
      resolveReminderNotice({
        permission: "denied",
        reminderCount: 2,
        overflow: 0,
      }),
    ).toBe("permission");
    expect(
      resolveReminderNotice({
        permission: "undetermined",
        reminderCount: 2,
        overflow: 0,
      }),
    ).toBe("permission");
  });

  it("prefers the permission notice over the ceiling", () => {
    expect(
      resolveReminderNotice({
        permission: "denied",
        reminderCount: 2,
        overflow: 4,
      }),
    ).toBe("permission");
  });

  it("reports the ceiling once permission is granted", () => {
    expect(
      resolveReminderNotice({
        permission: "granted",
        reminderCount: 90,
        overflow: 4,
      }),
    ).toBe("overflow");
  });

  it("says nothing when everything is scheduled", () => {
    expect(
      resolveReminderNotice({
        permission: "granted",
        reminderCount: 2,
        overflow: 0,
      }),
    ).toBe("none");
  });
});

describe("reminder reconciliation counts", () => {
  beforeEach(() => {
    recordReminderReconciliation({ overflow: 0 });
  });

  it("starts at zero", () => {
    expect(getReminderReconciliation()).toEqual({ overflow: 0 });
  });

  it("remembers the last recorded overflow", () => {
    recordReminderReconciliation({ overflow: 7 });

    expect(getReminderReconciliation()).toEqual({ overflow: 7 });
  });
});
