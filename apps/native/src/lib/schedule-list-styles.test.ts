import { describe, expect, it } from "vitest";
import { shouldBounceSchedule } from "./schedule-list-styles";

describe("shouldBounceSchedule", () => {
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
