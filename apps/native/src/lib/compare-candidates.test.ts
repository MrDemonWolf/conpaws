import { describe, expect, it } from "vitest";
import {
  type CompareEvent,
  compareCandidates,
  overlapMinutesBetween,
  planAfterChoice,
} from "./compare-candidates";

function at(hour: number, minute = 0): string {
  return new Date(Date.UTC(2026, 8, 19, hour + 4, minute, 0)).toISOString();
}

function event(
  id: string,
  start: string,
  end: string | null,
  saved = false,
  feedStatus: CompareEvent["feedStatus"] = null,
): CompareEvent {
  return {
    id,
    startTime: start,
    endTime: end,
    isInSchedule: saved,
    feedStatus,
  };
}

// A: 2–3, B: 2:30–3:30, C: 3:15–4. A and C never touch.
const a = event("a", at(14), at(15), true);
const b = event("b", at(14, 30), at(15, 30), true);
const c = event("c", at(15, 15), at(16), true);
const dropIn = event("market", at(10), at(18), true);

describe("overlapMinutesBetween", () => {
  it("returns the intersection, symmetrically", () => {
    expect(overlapMinutesBetween(a, b)).toBe(30);
    expect(overlapMinutesBetween(b, a)).toBe(30);
  });

  it("is zero for back-to-back and distant events", () => {
    expect(overlapMinutesBetween(a, event("d", at(15), at(16)))).toBe(0);
    expect(overlapMinutesBetween(a, c)).toBe(0);
  });

  it("never exceeds the shorter event", () => {
    const long = event("l", at(14), at(15, 30));
    const inside = event("i", at(14, 15), at(15, 15));
    expect(overlapMinutesBetween(long, inside)).toBe(60);
  });

  it("is zero when an end is unknown or the event is a drop-in", () => {
    expect(overlapMinutesBetween(a, event("open", at(14, 30), null))).toBe(0);
    expect(overlapMinutesBetween(a, dropIn)).toBe(0);
  });
});

describe("compareCandidates", () => {
  const unsaved = event("x", at(14, 45), at(15, 45));

  it("finds only direct, saved, live overlaps", () => {
    const set = compareCandidates([a, b, c, dropIn, unsaved], "a");
    expect(set?.conflicts.map((card) => card.id)).toEqual(["b"]);
    const setB = compareCandidates([a, b, c], "b");
    expect(setB?.conflicts.map((card) => card.id)).toEqual(["a", "c"]);
  });

  it("ignores saved events the feed cancelled", () => {
    const gone = { ...b, feedStatus: "cancelled" as const };
    expect(compareCandidates([a, gone], "a")?.conflicts).toEqual([]);
  });

  it("returns null for an unknown or cancelled candidate", () => {
    expect(compareCandidates([a], "missing")).toBeNull();
    expect(
      compareCandidates([{ ...unsaved, feedStatus: "removed" }], "x"),
    ).toBeNull();
  });

  it("orders cards with saved ones first, then by start", () => {
    const set = compareCandidates([a, b, c, unsaved], "x");
    expect(set?.cards.map((card) => card.id)).toEqual(["a", "b", "c", "x"]);
  });
});

describe("planAfterChoice", () => {
  const events = [a, b, c, event("x", at(14, 45), at(15, 45))];
  const set = compareCandidates(events, "x");
  if (!set) throw new Error("fixture");

  it("saves the candidate and unsaves its direct overlaps", () => {
    expect(planAfterChoice(set, "x", false)).toEqual({
      add: ["x"],
      remove: ["a", "b", "c"],
    });
  });

  it("keeps both when asked", () => {
    expect(planAfterChoice(set, "x", true)).toEqual({ add: ["x"], remove: [] });
  });

  it("choosing a saved card unsaves only the saved cards it overlaps", () => {
    expect(planAfterChoice(set, "a", false)).toEqual({
      add: [],
      remove: ["b"],
    });
    expect(planAfterChoice(set, "c", false)).toEqual({
      add: [],
      remove: ["b"],
    });
  });

  it("is a no-op for an unknown selection", () => {
    expect(planAfterChoice(set, "nope", false)).toEqual({
      add: [],
      remove: [],
    });
  });

  it("never mutates its inputs", () => {
    const frozen = structuredClone(set);
    planAfterChoice(set, "x", false);
    expect(set).toEqual(frozen);
  });
});
