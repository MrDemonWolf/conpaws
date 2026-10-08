import { describe, expect, it } from "vitest";
import {
  buildBlankPreviewFixture,
  buildConPawsPreviewFixture,
} from "./conpaws-preview";

describe("preview fixture dates", () => {
  it("keeps both conventions live relative to the injected clock", () => {
    const now = new Date("2026-10-07T16:00:00.000Z");
    const preview = buildConPawsPreviewFixture(now);
    const blank = buildBlankPreviewFixture(now);
    expect(preview.convention.startDate).toBe("2026-10-06");
    expect(preview.convention.endDate).toBe("2026-10-09");
    expect(preview.events[0]?.startTime).toBe("2026-10-06T23:00:00.000Z");
    expect(blank.convention.startDate).toBe(preview.convention.startDate);
    expect(blank.convention.endDate).toBe(preview.convention.endDate);
  });
});
