import { describe, expect, it } from "vitest";
import { buildFixtureCatalog } from "./fixture-source";

describe("sample catalog fixture", () => {
  it("builds three fictional editions relative to now", () => {
    const now = new Date("2026-10-08T12:00:00.000Z");
    const [upcoming, notReleased, past] = buildFixtureCatalog(now);

    expect(buildFixtureCatalog(now)).toHaveLength(3);
    expect(upcoming.startsOn).toBe("2026-10-20");
    expect(upcoming.endsOn).toBe("2026-10-22");
    expect(
      upcoming.sessions.some((session) => session.status === "cancelled"),
    ).toBe(true);
    expect(notReleased.startsOn).toBe("2026-11-17");
    expect(notReleased.scheduleStatus).toBe("not-released");
    expect(notReleased.sessions).toEqual([]);
    expect(past.endsOn).toBe("2026-09-08");
    expect(
      [upcoming, notReleased, past].every((edition) =>
        edition.name.startsWith("Sample "),
      ),
    ).toBe(true);
  });
});
