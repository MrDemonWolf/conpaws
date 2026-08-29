import { describe, expect, it } from "vitest";
import { eventSwipeSides } from "./event-swipe";

describe("eventSwipeSides", () => {
  it("offers add on the leading edge for an unstarred event", () => {
    expect(eventSwipeSides(false).leading).toBe("add");
  });

  it("offers no removal for an unstarred event", () => {
    expect(eventSwipeSides(false).trailing).toBeNull();
  });

  it("offers remove on the trailing edge for a starred event", () => {
    expect(eventSwipeSides(true).trailing).toBe("remove");
  });

  it("offers no add for a starred event", () => {
    expect(eventSwipeSides(true).leading).toBeNull();
  });
});
