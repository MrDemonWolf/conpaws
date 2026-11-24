import { beforeEach, describe, expect, it } from "vitest";
import {
  handledWatchCommandIds,
  isHandledWatchCommand,
  recordHandledWatchCommands,
  resetHandledWatchCommands,
  restoreWatchCommandReceipts,
  WATCH_COMMAND_MAX_AGE_MS,
  WATCH_COMMAND_OUTCOMES,
  WATCH_HANDLED_COMMANDS_LIMIT,
  watchCommandOutcomes,
  watchCommandReceipts,
} from "./watch-command-receipts";

const NOW = Date.parse("2026-09-04T15:00:00Z");

beforeEach(() => {
  resetHandledWatchCommands();
});

describe("Watch command receipts", () => {
  it("keeps what the phone did with each command", () => {
    recordHandledWatchCommands(
      [
        { id: "saved", outcome: "applied" },
        { id: "late", outcome: "superseded" },
      ],
      NOW,
    );
    expect(watchCommandOutcomes(["saved", "late", "unknown"])).toEqual({
      saved: "applied",
      late: "superseded",
    });
    expect(isHandledWatchCommand("late")).toBe(true);
  });

  it("lists receipts oldest first, with when each was handled", () => {
    recordHandledWatchCommands([{ id: "first", outcome: "applied" }], NOW - 10);
    recordHandledWatchCommands([{ id: "second", outcome: "failed" }], NOW);
    expect(watchCommandReceipts(NOW)).toEqual([
      { id: "first", outcome: "applied", handledAtMs: NOW - 10 },
      { id: "second", outcome: "failed", handledAtMs: NOW },
    ]);
  });

  it("names every outcome the phone can report", () => {
    expect(WATCH_COMMAND_OUTCOMES).toEqual([
      "applied",
      "unchanged",
      "expired",
      "missing",
      "superseded",
      "not-allowed",
      "cancelled",
      "removed",
      "failed",
    ]);
  });
});

describe("restoring receipts an earlier process stored", () => {
  it("brings back a day of receipts with their outcomes", () => {
    const added = restoreWatchCommandReceipts(
      [
        { id: "kept", outcome: "superseded", handledAtMs: NOW - 60_000 },
        {
          id: "old",
          outcome: "applied",
          handledAtMs: NOW - WATCH_COMMAND_MAX_AGE_MS - 1,
        },
      ],
      NOW,
    );
    expect(added).toBe(1);
    expect(handledWatchCommandIds(NOW)).toEqual(["kept"]);
    expect(watchCommandOutcomes(["kept"])).toEqual({ kept: "superseded" });
  });

  it("skips anything it cannot trust", () => {
    const added = restoreWatchCommandReceipts(
      [
        { id: "good", outcome: "not-allowed", handledAtMs: NOW },
        { id: "", outcome: "applied", handledAtMs: NOW },
        { id: "x".repeat(256), outcome: "applied", handledAtMs: NOW },
        { id: "future-outcome", outcome: "teleported", handledAtMs: NOW },
        { id: "no-time", outcome: "applied" },
        { id: "nan", outcome: "applied", handledAtMs: Number.NaN },
        "not a receipt",
        null,
      ],
      NOW,
    );
    expect(added).toBe(1);
    expect(handledWatchCommandIds(NOW)).toEqual(["good"]);
  });

  it.each([null, "not a list", { id: "a" }, 42])(
    "restores nothing from %j",
    (stored) => {
      expect(restoreWatchCommandReceipts(stored, NOW)).toBe(0);
      expect(handledWatchCommandIds(NOW)).toEqual([]);
    },
  );

  it("keeps this process's receipt over a stored one for the same id", () => {
    recordHandledWatchCommands([{ id: "cmd", outcome: "applied" }], NOW);
    expect(
      restoreWatchCommandReceipts(
        [{ id: "cmd", outcome: "failed", handledAtMs: NOW - 1_000 }],
        NOW,
      ),
    ).toBe(0);
    expect(watchCommandOutcomes(["cmd"])).toEqual({ cmd: "applied" });
  });

  it("merges by when each was handled and still keeps only the newest fifty", () => {
    recordHandledWatchCommands([{ id: "newest", outcome: "applied" }], NOW);
    const stored = Array.from(
      { length: WATCH_HANDLED_COMMANDS_LIMIT },
      (_, index) => ({
        id: `stored-${index}`,
        outcome: "unchanged",
        handledAtMs: NOW - 60_000 + index,
      }),
    );
    restoreWatchCommandReceipts(stored, NOW);
    const ids = handledWatchCommandIds(NOW);
    expect(ids).toHaveLength(WATCH_HANDLED_COMMANDS_LIMIT);
    expect(ids.at(-1)).toBe("newest");
    expect(ids[0]).toBe("stored-1");
  });

  it("reads a stamp from the future as now, so it still expires in a day", () => {
    restoreWatchCommandReceipts(
      [{ id: "ahead", outcome: "applied", handledAtMs: NOW + 1e9 }],
      NOW,
    );
    expect(watchCommandReceipts(NOW)[0]?.handledAtMs).toBe(NOW);
    expect(handledWatchCommandIds(NOW + WATCH_COMMAND_MAX_AGE_MS + 1)).toEqual(
      [],
    );
  });
});
