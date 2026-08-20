import { describe, expect, it } from "vitest";
import { getEventIndicators } from "./event-indicators";

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
