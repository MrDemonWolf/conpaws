import { describe, expect, it } from "vitest";
import { withoutNulls } from "./property-list";

describe("withoutNulls", () => {
  it("drops null and undefined fields at every depth", () => {
    expect(
      withoutNulls({
        title: "Opening",
        room: null,
        reminderMinutes: undefined,
        nested: { endAtMs: null, startAtMs: 0, label: "" },
        events: [{ id: "a", ageRating: null }, null, { id: "b" }],
      }),
    ).toEqual({
      title: "Opening",
      nested: { startAtMs: 0, label: "" },
      events: [{ id: "a" }, { id: "b" }],
    });
  });

  it("keeps falsy values that are not null, and dates", () => {
    const date = new Date(0);
    expect(withoutNulls({ count: 0, expired: false, date })).toEqual({
      count: 0,
      expired: false,
      date,
    });
    expect(withoutNulls({ date }).date).toBe(date);
  });
});
