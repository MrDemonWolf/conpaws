import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * How a schedule reaches the Watch while the Watch app is closed. No CI job
 * compiles the Watch target or the phone's pod, and none of this can be
 * observed without a paired device, so a lost line here fails silently: the
 * complication keeps counting down to an old panel until the app is opened.
 * This holds the pieces in place; a paired-device check with the Watch app
 * closed is still the only proof that delivery works.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), "utf8");
const app = read("../../targets/watch/index.swift");
const store = read("../../targets/watch/WatchScheduleStore.swift");
const module = read(
  "../../modules/conpaws-widgets/ios/ConPawsWidgetsModule.swift",
);

const drain =
  store.match(/func drainPendingContent\(\) async \{[\s\S]*?\n {2}\}/)?.[0] ??
  "";
const publish =
  module.match(/AsyncFunction\("publishSnapshot"\)[\s\S]*?\n {4}\}/)?.[0] ?? "";

describe("Watch schedule delivery", () => {
  it("keeps a background wake open until the schedule is stored", () => {
    // watchOS launches or wakes the app in the background for a new context
    // or user info, and suspends it as soon as this handler returns.
    expect(app).toMatch(
      /\.backgroundTask\(\s*\.watchConnectivity\s*\)\s*\{\s*await WatchScheduleStore\.shared\.drainPendingContent\(\)\s*\}/,
    );
    expect(drain).toContain("activationState != .activated");
    expect(drain).toContain("hasContentPending");
    expect(drain).toContain("Task.isCancelled");
    // The save runs on receiveQueue and the complication reload on main.
    expect(drain).toMatch(/receiveQueue\.async[\s\S]*DispatchQueue\.main/);
  });

  it("uses one store, so one WatchConnectivity delegate, made at launch", () => {
    expect(store).toContain("static let shared = WatchScheduleStore()");
    expect(store).toContain("private override init()");
    expect(app).toContain("private let store = WatchScheduleStore.shared");
    expect(app).not.toContain("WatchScheduleStore()");
  });

  it("queues a transfer only when the schedule changes, not its timestamp", () => {
    // Every publish stamps a new generatedAtMs. Comparing raw strings queued
    // a full transfer each time, and the Watch replayed the backlog.
    expect(module).toContain('removeValue(forKey: "generatedAtMs")');
    expect(publish).toMatch(
      /watchBridge\.publish\(json, changed: Self\.hasNewContent\(json, since: stored\)\)/,
    );
  });

  it("sends a changed schedule as complication data while there is budget", () => {
    expect(module).toMatch(
      /session\.isComplicationEnabled,\s*session\.remainingComplicationUserInfoTransfers > 0[\s\S]*?session\.transferCurrentComplicationUserInfo\(payload\)[\s\S]*?session\.transferUserInfo\(payload\)/,
    );
  });

  it("decides which snapshot wins in shared code the Swift tests cover", () => {
    expect(store).toContain("ConPawsSnapshotStore.shouldReplace(");
    expect(store).not.toContain("rewindMs");
  });
});
