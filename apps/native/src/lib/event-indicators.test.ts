import { describe, expect, it } from "vitest";
import { getEventIndicators, shouldShowProvenance } from "./event-indicators";

describe("getEventIndicators", () => {
  it("marks source-backed events as imported without requiring a source URL", () => {
    expect(
      getEventIndicators({ reminderMinutes: null, sourceUid: "sched-123" }),
    ).toEqual({ provenance: "imported", reminder: null });
  });

  it("marks events without a source identity as added", () => {
    expect(
      getEventIndicators({ reminderMinutes: null, sourceUid: null }),
    ).toEqual({ provenance: "added", reminder: null });
  });

  it("keeps configured reminder timing and identifies the one-hour label", () => {
    expect(
      getEventIndicators({ reminderMinutes: 15, sourceUid: null }),
    ).toEqual({
      provenance: "added",
      reminder: { kind: "minutes", minutes: 15 },
    });
    expect(
      getEventIndicators({ reminderMinutes: 60, sourceUid: null }),
    ).toEqual({
      provenance: "added",
      reminder: { kind: "hour", minutes: 60 },
    });
  });
});

describe("shouldShowProvenance", () => {
  const imported = { reminderMinutes: null, sourceUid: "uid-1" };
  const added = { reminderMinutes: null, sourceUid: null };

  it("stays hidden when every event came from the same place", () => {
    expect(shouldShowProvenance([imported, imported])).toBe(false);
    expect(shouldShowProvenance([added, added])).toBe(false);
  });

  it("shows once the schedule actually mixes sources", () => {
    expect(shouldShowProvenance([imported, added])).toBe(true);
    expect(shouldShowProvenance([added, imported])).toBe(true);
  });

  it("stays hidden for an empty schedule", () => {
    expect(shouldShowProvenance([])).toBe(false);
  });
});
