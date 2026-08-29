import { describe, expect, it } from "vitest";
import { detectFeedSource } from "../feed-source";

function calendar(...lines: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...lines, "END:VCALENDAR"].join(
    "\r\n",
  );
}

describe("detectFeedSource", () => {
  it("reads a Sched export off its PRODID", () => {
    expect(
      detectFeedSource(
        calendar(
          "PRODID:-//Sched.com Sched Example Con//EN",
          "CALSCALE:GREGORIAN",
        ),
      ),
    ).toBe("sched");
  });

  it("treats a convention's own export as generic", () => {
    expect(
      detectFeedSource(
        calendar("PRODID:-//ConPaws//Event Ticket Con 2026//EN"),
      ),
    ).toBe("generic");
  });

  it("falls back to a Sched event URL when PRODID is missing", () => {
    expect(
      detectFeedSource(
        calendar(
          "BEGIN:VEVENT",
          "UID:abc",
          "URL:http://schedexamplecon.sched.com/event/abc",
          "END:VEVENT",
        ),
      ),
    ).toBe("sched");
  });

  it("finds that URL even when the feed folded it across lines", () => {
    // The fallback runs on unfolded text, so a permalink broken by RFC 5545
    // folding still matches.
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "URL:http://schedexamplec",
      " on.sched.com/event/abc",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(detectFeedSource(raw)).toBe("sched");
  });

  it("is generic when nothing points at Sched", () => {
    expect(
      detectFeedSource(
        calendar(
          "BEGIN:VEVENT",
          "UID:evt2026-5000@eventticketcon.example.org",
          "URL:https://eventticketcon.example.org/panel/example/",
          "END:VEVENT",
        ),
      ),
    ).toBe("generic");
  });

  it("is generic for empty and whitespace input", () => {
    expect(detectFeedSource("")).toBe("generic");
    expect(detectFeedSource("   \r\n  ")).toBe("generic");
  });
});
