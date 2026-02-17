import { describe, it, expect } from "vitest";
import {
  formatDateRange,
  formatTime,
  formatEventTime,
  getConventionStatus,
  groupEventsByDay,
} from "../date-utils";
import type { ConventionEvent } from "@/types";

describe("formatDateRange", () => {
  it("formats same-month range", () => {
    const result = formatDateRange("2026-07-02T12:00:00Z", "2026-07-05T12:00:00Z");
    expect(result).toContain("Jul");
    expect(result).toContain("2026");
  });

  it("formats cross-month range", () => {
    const result = formatDateRange("2026-06-28T00:00:00Z", "2026-07-02T00:00:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("Jul");
  });
});

describe("formatTime", () => {
  it("formats time correctly", () => {
    const result = formatTime("2026-07-02T14:30:00Z");
    expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
  });
});

describe("formatEventTime", () => {
  it("formats event time range", () => {
    const result = formatEventTime(
      "2026-07-02T14:00:00Z",
      "2026-07-02T15:00:00Z",
    );
    expect(result).toContain(" - ");
  });
});

describe("getConventionStatus", () => {
  it("returns upcoming for future dates", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const end = new Date(future);
    end.setDate(end.getDate() + 3);
    expect(
      getConventionStatus(future.toISOString(), end.toISOString()),
    ).toBe("upcoming");
  });

  it("returns ended for past dates", () => {
    expect(
      getConventionStatus("2020-01-01T00:00:00Z", "2020-01-05T00:00:00Z"),
    ).toBe("ended");
  });

  it("returns active for current dates", () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    const end = new Date();
    end.setDate(end.getDate() + 1);
    expect(
      getConventionStatus(start.toISOString(), end.toISOString()),
    ).toBe("active");
  });
});

describe("groupEventsByDay", () => {
  it("groups events by day and sorts", () => {
    const events = [
      {
        id: "1",
        startTime: "2026-07-03T14:00:00Z",
        endTime: "2026-07-03T15:00:00Z",
      },
      {
        id: "2",
        startTime: "2026-07-02T10:00:00Z",
        endTime: "2026-07-02T11:00:00Z",
      },
      {
        id: "3",
        startTime: "2026-07-02T14:00:00Z",
        endTime: "2026-07-02T15:00:00Z",
      },
    ] as ConventionEvent[];

    const grouped = groupEventsByDay(events);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].data).toHaveLength(2);
    expect(grouped[1].data).toHaveLength(1);
    // First group should be Jul 2 (earlier date)
    expect(grouped[0].data[0].id).toBe("2");
  });

  it("handles empty array", () => {
    expect(groupEventsByDay([])).toHaveLength(0);
  });
});
