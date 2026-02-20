import { describe, it, expect } from "vitest";
import { isValidSchedUrl, getSchedIcsUrl } from "../sched-url";

describe("isValidSchedUrl", () => {
  it("accepts valid sched URLs", () => {
    expect(isValidSchedUrl("https://mycon2026.sched.com")).toBe(true);
    expect(isValidSchedUrl("https://mycon2026.sched.com/")).toBe(true);
    expect(isValidSchedUrl("http://mycon2026.sched.com")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isValidSchedUrl("https://google.com")).toBe(false);
    expect(isValidSchedUrl("not a url")).toBe(false);
    expect(isValidSchedUrl("https://mycon2026.sched.com/event/123")).toBe(false);
    expect(isValidSchedUrl("")).toBe(false);
  });
});

describe("getSchedIcsUrl", () => {
  it("constructs correct .ics URL", () => {
    expect(getSchedIcsUrl("https://mycon2026.sched.com")).toBe(
      "https://mycon2026.sched.com/all.ics",
    );
  });

  it("handles trailing slash", () => {
    expect(getSchedIcsUrl("https://mycon2026.sched.com/")).toBe(
      "https://mycon2026.sched.com/all.ics",
    );
  });

  it("throws on invalid URL", () => {
    expect(() => getSchedIcsUrl("https://google.com")).toThrow();
  });
});
