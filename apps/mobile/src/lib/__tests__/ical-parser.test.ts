import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseICalContent } from "../ical-parser";

const SMALL_TEST_PATH = resolve(
  __dirname,
  "../../../../../test-data/small-test.ics",
);
const INDY_PATH = resolve(
  __dirname,
  "../../../../../test-data/indyfurcon2025.ics",
);

describe("parseICalContent", () => {
  describe("small-test.ics", () => {
    const icsContent = readFileSync(SMALL_TEST_PATH, "utf-8");
    const parsed = parseICalContent(icsContent);

    it("parses calendar name", () => {
      expect(parsed.name).toBe("TestCon 2026");
    });

    it("parses all 10 events", () => {
      expect(parsed.events).toHaveLength(10);
    });

    it("parses event titles", () => {
      const titles = parsed.events.map((e) => e.title);
      expect(titles).toContain("Opening Ceremonies");
      expect(titles).toContain("Fursuit Parade");
      expect(titles).toContain("Closing Ceremonies");
    });

    it("parses categories", () => {
      const opening = parsed.events.find(
        (e) => e.title === "Opening Ceremonies",
      );
      expect(opening?.category).toBe("CONVENTION SERVICES");
    });

    it("parses location into room and venue", () => {
      const opening = parsed.events.find(
        (e) => e.title === "Opening Ceremonies",
      );
      expect(opening?.room).toBe("Main Stage");
      expect(opening?.location).toBe("Convention Center");
    });

    it("detects age restrictions", () => {
      const trivia = parsed.events.find((e) => e.title === "After Dark Trivia");
      expect(trivia?.isAgeRestricted).toBe(true);

      const opening = parsed.events.find(
        (e) => e.title === "Opening Ceremonies",
      );
      expect(opening?.isAgeRestricted).toBe(false);
    });

    it("detects strobe content warnings", () => {
      const dance = parsed.events.find(
        (e) => e.title === "Friday Night Dance",
      );
      expect(dance?.contentWarning).toContain("Strobe effects");
      expect(dance?.contentWarning).toContain("Flashing lights");
    });

    it("parses source UIDs", () => {
      const opening = parsed.events.find(
        (e) => e.title === "Opening Ceremonies",
      );
      expect(opening?.uid).toBe("test-opening-001");
    });

    it("parses source URLs", () => {
      const opening = parsed.events.find(
        (e) => e.title === "Opening Ceremonies",
      );
      expect(opening?.sourceUrl).toContain("sched.com");
    });

    it("detects start and end dates", () => {
      expect(parsed.startDate).toBeTruthy();
      expect(parsed.endDate).toBeTruthy();
      expect(new Date(parsed.startDate).getTime()).toBeLessThan(
        new Date(parsed.endDate).getTime(),
      );
    });

    it("events are sorted by start time", () => {
      for (let i = 1; i < parsed.events.length; i++) {
        expect(parsed.events[i].startTime >= parsed.events[i - 1].startTime).toBe(true);
      }
    });
  });

  describe("indyfurcon2025.ics", () => {
    const icsContent = readFileSync(INDY_PATH, "utf-8");
    const parsed = parseICalContent(icsContent);

    it("parses calendar name", () => {
      expect(parsed.name).toBe("indyfurcon2025");
    });

    it("parses all 16 events", () => {
      expect(parsed.events).toHaveLength(16);
    });

    it("decodes HTML entities in descriptions", () => {
      const origami = parsed.events.find(
        (e) => e.title === "Make-Your-Own Origami Dice",
      );
      expect(origami?.description).not.toContain("&nbsp;");
    });

    it("detects strobe warnings in dance events", () => {
      const dance = parsed.events.find(
        (e) => e.title === "Thursday Night Dance",
      );
      expect(dance?.contentWarning).toContain("Strobe effects");
    });

    it("parses room from complex locations", () => {
      const origami = parsed.events.find(
        (e) => e.title === "Make-Your-Own Origami Dice",
      );
      expect(origami?.room).toBeTruthy();
    });
  });
});
