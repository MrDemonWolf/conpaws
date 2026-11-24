import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A tap the phone declines shows no change, so its receipt in
 * `handledCommandIds` is the only thing that frees the Watch button before the
 * day runs out, and its outcome in `commandOutcomes` is the only way the
 * Watch can say why. The Swift tests cover what
 * `ConPawsPendingCommands.settling` decides and what `ConPawsWatchTapLog`
 * keeps; no CI job compiles the Watch target, so this holds the store and
 * the feedback model to using them.
 */
const here = dirname(fileURLToPath(import.meta.url));
const watch = (file: string) =>
  readFileSync(resolve(here, `../../targets/watch/${file}`), "utf8");
const store = watch("WatchScheduleStore.swift");
const feedback = watch("WatchTapFeedback.swift");

const body = (source: string, signature: RegExp) =>
  source.match(
    new RegExp(`${signature.source}[^{]*\\{[\\s\\S]*?\\n {2}\\}`),
  )?.[0] ?? "";

const save = body(store, /func save\(_ json: String\)/);
const notShown =
  save.match(
    /ConPawsSnapshotStore\.shouldReplace\([\s\S]*?\)\s*else \{([\s\S]*?)\n {4}\}/,
  )?.[1] ?? "";

describe("Watch receipts in a snapshot too old to show", () => {
  it("settles the taps it lists as handled, judged against the shown schedule", () => {
    expect(notShown).toContain("DispatchQueue.main.async");
    expect(notShown).toContain(
      "settlePendingCommands(byReceiptsIn: candidate)",
    );
    expect(
      body(store, /private func settlePendingCommands\(byReceiptsIn/),
    ).toContain(
      "ConPawsPendingCommands.settling(pendingCommands, byReceiptsIn: receipts, shown: snapshot)",
    );
  });
});

describe("what the Watch says about a settled tap", () => {
  const settles = [
    body(store, /private func settlePendingCommands\(\s*against/),
    body(store, /private func settlePendingCommands\(byReceiptsIn/),
  ];

  it("records each result before the button stops waiting", () => {
    for (const settle of settles) {
      // With the table it settled, before it is replaced: that table is
      // what says which button each reason belongs under.
      const recorded = settle.search(
        /tapFeedback\.record\(\s*settlement\.results, of: pendingCommands,/,
      );
      const updated = settle.indexOf(
        "updatePendingCommands(settlement.pending)",
      );
      expect(recorded).toBeGreaterThan(-1);
      expect(updated).toBeGreaterThan(recorded);
    }
  });

  it("stays silent for what the launch settles, and clears a reason on a new tap", () => {
    expect(body(store, /private override init\(\)/)).toContain(
      "tellsWearer: false",
    );
    expect(body(store, /func send\(/)).toContain(
      "tapFeedback.forget(event.id)",
    );
  });

  it("buzzes once and speaks a decline, only while the app is in front", () => {
    const record = body(feedback, /func record\(/);
    expect(record).toContain(
      "WKApplication.shared().applicationState == .active",
    );
    expect(record).toContain("WKInterfaceDevice.current().play(.success)");
    expect(record).toContain("WKInterfaceDevice.current().play(.failure)");
    expect(record).toContain(
      "ConPawsWatchTapLog.announcedDecline(in: results)",
    );
    expect(record).toContain("AccessibilityNotification.Announcement(");
  });

  it("shows the reason under the button from the shared log", () => {
    const detail = watch("EventDetailView.swift");
    // Only under the button the declined tap was for: once the phone has
    // changed the panel the other way, the reason no longer fits.
    expect(detail).toContain(
      "tapFeedback.decline(for: event.id, action: planAction.commandAction, at: now)",
    );
    expect(watch("PlanActionButton.swift")).toContain(
      "strings.declineText(decline)",
    );
  });
});
