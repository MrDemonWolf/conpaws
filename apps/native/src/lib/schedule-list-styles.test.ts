import { describe, expect, it } from "vitest";
import {
  canScrollSchedule,
  shouldBounceSchedule,
  showsScheduleHeader,
} from "./schedule-list-styles";

describe("shouldBounceSchedule", () => {
  it("keeps empty layouts still at normal text size and reachable at large text", () => {
    expect(canScrollSchedule(false, 1)).toBe(false);
    expect(canScrollSchedule(false, 2)).toBe(true);
    expect(canScrollSchedule(true, 1)).toBe(true);
  });

  it("does not bounce an empty schedule", () => {
    // The empty state is a centred panel filling the viewport. Rubber-banding
    // it under the finger reads as a broken screen rather than an empty one.
    expect(shouldBounceSchedule([])).toBe(false);
  });

  it("bounces as soon as there is a day to show", () => {
    // A single short day still has to bounce: iOS only lays the large title
    // into the content inset of a scroll view that can scroll, so a list that
    // fits on screen without this paints the title over its first row.
    expect(shouldBounceSchedule([{ title: "Friday", data: [] }])).toBe(true);
  });
});

describe("showsScheduleHeader", () => {
  it("keeps the Now hero card when no other panel fits this hour", () => {
    // The hero lives in the header and replaces the empty state. Hiding the
    // header with no rows left the Now view blank, with no way back.
    expect(showsScheduleHeader("now", 0, true)).toBe(true);
    expect(shouldBounceSchedule([], true)).toBe(true);
  });

  it("gives an empty Plan or Now view to its centred empty state", () => {
    expect(showsScheduleHeader("now", 0, false)).toBe(false);
    expect(showsScheduleHeader("mine", 0, false)).toBe(false);
    expect(showsScheduleHeader("mine", 0, true)).toBe(false);
  });

  it("always keeps Browse's filters, and any view with rows", () => {
    expect(showsScheduleHeader("all", 0, false)).toBe(true);
    expect(showsScheduleHeader("mine", 2, false)).toBe(true);
    expect(showsScheduleHeader("now", 1, false)).toBe(true);
  });
});
