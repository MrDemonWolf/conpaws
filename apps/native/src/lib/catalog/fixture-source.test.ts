import { describe, expect, it } from "vitest";
import { ScheduleFetchCancelledError } from "@/lib/sched-extractor";
import { buildFixtureCatalog, fixtureCatalogSource } from "./fixture-source";

describe("sample catalog fixture", () => {
  it("builds three fictional editions relative to now", () => {
    const now = new Date("2026-10-08T12:00:00.000Z");
    const [upcoming, notReleased, past] = buildFixtureCatalog(now);

    expect(buildFixtureCatalog(now)).toHaveLength(3);
    expect(upcoming.startsOn).toBe("2026-10-20");
    expect(upcoming.endsOn).toBe("2026-10-23");
    expect(
      upcoming.sessions.some((session) => session.status === "cancelled"),
    ).toBe(true);
    expect(notReleased.startsOn).toBe("2026-11-17");
    expect(notReleased.scheduleStatus).toBe("not-released");
    expect(notReleased.sessions).toEqual([]);
    expect(past.endsOn).toBe("2026-09-09");
    expect(
      [upcoming, notReleased, past].every((edition) =>
        edition.name.startsWith("Sample "),
      ),
    ).toBe(true);
  });
});

describe("fixtureCatalogSource", () => {
  // A polyfill-shaped signal, as React Native hands out: `aborted` only.
  it("lists and serves a schedule without AbortSignal#throwIfAborted", async () => {
    const signal = { aborted: false } as AbortSignal;
    const editions = await fixtureCatalogSource.list(signal);
    expect(editions).toHaveLength(3);
    const schedule = await fixtureCatalogSource.schedule(
      editions[0].slug,
      signal,
    );
    expect(schedule.slug).toBe(editions[0].slug);
    expect(schedule.sessions.length).toBeGreaterThan(0);
  });

  it("reports an aborted request as a cancellation", async () => {
    const signal = { aborted: true } as AbortSignal;
    await expect(fixtureCatalogSource.list(signal)).rejects.toBeInstanceOf(
      ScheduleFetchCancelledError,
    );
    await expect(
      fixtureCatalogSource.schedule("sample-lakeside-fur-con", signal),
    ).rejects.toBeInstanceOf(ScheduleFetchCancelledError);
  });
});
