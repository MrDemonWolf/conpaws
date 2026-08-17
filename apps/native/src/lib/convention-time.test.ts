import { describe, expect, it } from "vitest";
import {
  conventionDayKey,
  formatInConventionTime,
  isValidTimeZone,
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
});
