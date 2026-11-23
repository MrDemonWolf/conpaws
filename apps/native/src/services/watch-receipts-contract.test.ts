import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A tap the phone declines shows no change, so its receipt in
 * `handledCommandIds` is the only thing that frees the Watch button before the
 * day runs out. The phone keeps receipts in memory (watch-command-receipts.ts),
 * so after a relaunch the newest snapshot can lack one that an older, replayed
 * snapshot still carries. The Swift tests cover what
 * `ConPawsPendingCommands.settled(_:byReceiptsIn:)` keeps; no CI job compiles
 * the Watch target, so this holds the store to calling it for a snapshot it
 * does not show.
 */
const here = dirname(fileURLToPath(import.meta.url));
const store = readFileSync(
  resolve(here, "../../targets/watch/WatchScheduleStore.swift"),
  "utf8",
);

const save =
  store.match(/func save\(_ json: String\) \{[\s\S]*?\n {2}\}/)?.[0] ?? "";
const notShown =
  save.match(
    /ConPawsSnapshotStore\.shouldReplace\([\s\S]*?\)\s*else \{([\s\S]*?)\n {4}\}/,
  )?.[1] ?? "";

describe("Watch receipts in a snapshot too old to show", () => {
  it("settles the taps it lists as handled", () => {
    expect(notShown).toContain("DispatchQueue.main.async");
    expect(notShown).toContain(
      "settlePendingCommands(byReceiptsIn: candidate)",
    );
    expect(store).toMatch(
      /func settlePendingCommands\(byReceiptsIn snapshot: ConPawsSnapshot\) \{\s*updatePendingCommands\(\s*ConPawsPendingCommands\.settled\(pendingCommands, byReceiptsIn: snapshot\)/,
    );
  });
});
