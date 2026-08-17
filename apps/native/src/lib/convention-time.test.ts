import { describe, expect, it } from "vitest";
import {
  conventionDayKey,
  formatInConventionTime,
  isValidTimeZone,
  overlappingEventIds,
} from "./convention-time";

describe("convention time", () => {
  it("uses the convention day when UTC has crossed midnight", () => {
    const instant = "2026-07-16T01:00:00.000Z";

    expect(conventionDayKey(instant, "America/Chicago")).toBe("2026-07-15");
    expect(formatInConventionTime(instant, "America/Chicago", "h:mm a")).toBe(
      "8:00 PM",
    );
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Not/A_Time_Zone")).toBe(false);
  });

  it("finds arbitrary overlaps without flagging back-to-back events", () => {
    const conflicts = overlappingEventIds([
      {
        id: "long-panel",
        startTime: "2026-07-16T19:00:00.000Z",
        endTime: "2026-07-16T21:00:00.000Z",
      },
      {
        id: "late-start",
        startTime: "2026-07-16T20:30:00.000Z",
        endTime: "2026-07-16T21:30:00.000Z",
      },
      {
        id: "back-to-back",
        startTime: "2026-07-16T21:30:00.000Z",
        endTime: "2026-07-16T22:00:00.000Z",
      },
    ]);

    expect([...conflicts].sort()).toEqual(["late-start", "long-panel"]);
  });
});
