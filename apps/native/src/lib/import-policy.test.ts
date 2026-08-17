import { describe, expect, it } from "vitest";
import { canApplyScheduleImport } from "./import-policy";

const emptyImport = {
  conventionId: "convention-1",
  sourceUrl: null,
  selectedEventCount: 0,
  sourceEventCount: 0,
  cancelledEventCount: 0,
};

describe("schedule import policy", () => {
  it("allows an empty authoritative feed for an existing convention", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        sourceUrl: "https://example.sched.com",
      }),
    ).toBe(true);
  });

  it("rejects an empty feed for a new convention", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        conventionId: "new",
        sourceUrl: "https://example.sched.com",
      }),
    ).toBe(false);
  });

  it("rejects an empty local file", () => {
    expect(canApplyScheduleImport(emptyImport)).toBe(false);
  });

  it("allows an existing local cancellation tombstone", () => {
    expect(
      canApplyScheduleImport({ ...emptyImport, cancelledEventCount: 1 }),
    ).toBe(true);
  });

  it("rejects deselecting every event in a nonempty feed", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        sourceUrl: "https://example.sched.com",
        sourceEventCount: 4,
      }),
    ).toBe(false);
  });

  it("allows any source with a selected active event", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        conventionId: "new",
        selectedEventCount: 1,
        sourceEventCount: 1,
      }),
    ).toBe(true);
  });
});
