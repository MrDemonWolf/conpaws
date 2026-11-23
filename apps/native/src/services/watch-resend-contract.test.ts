import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * How a Watch that has none of the schedule gets it while the phone app keeps
 * running: a newly active Watch after an Auto Switch, or a Watch app just
 * installed or reinstalled. Once a context is sent the bridge forgets it, so
 * without these the new Watch waits until the phone app is next opened. No CI
 * job compiles the phone's pod or runs WatchConnectivity, so this holds the
 * pieces in place; a switch between two paired Watches and a Watch app
 * reinstall still need checking on a paired simulator or device.
 */
const here = dirname(fileURLToPath(import.meta.url));
const module = readFileSync(
  resolve(here, "../../modules/conpaws-widgets/ios/ConPawsWidgetsModule.swift"),
  "utf8",
);
const body = (start: RegExp) =>
  module.match(new RegExp(`${start.source}[\\s\\S]*?\\n {2}\\}`))?.[0] ?? "";

const deactivate = body(/func sessionDidDeactivate\(_ session: WCSession\) \{/);
const activation = body(/activationDidCompleteWith activationState/);
const watchState = body(
  /func sessionWatchStateDidChange\(_ session: WCSession\) \{/,
);
const resend = body(/private func resendLastSnapshot\(\) \{/);
const stored = body(/private static func storedSnapshot\(\) -> String\? \{/);
const publish =
  module.match(/AsyncFunction\("publishSnapshot"\)[\s\S]*?\n {4}\}/)?.[0] ?? "";

describe("Watch schedule after a switch or reinstall", () => {
  it("marks a deactivation for a resend before activating again", () => {
    expect(module).toContain("private var needsResendAfterSwitch = false");
    expect(deactivate).toMatch(
      /queue\.async \{[\s\S]*?self\.needsResendAfterSwitch = true[\s\S]*?session\.activate\(\)/,
    );
  });

  it("resends on the activation after a switch, never on the launch one", () => {
    expect(activation).toMatch(
      /if self\.needsResendAfterSwitch \{\s*self\.needsResendAfterSwitch = false\s*self\.resendLastSnapshot\(\)\s*\}[\s\S]*?self\.flushIfActivated\(session\)/,
    );
  });

  it("resends when the Watch app arrives, not on every watch-state change", () => {
    // A complication switched on or off is a watch-state change too, and a
    // transfer each time would spend the day's complication budget.
    expect(module).toContain("private var couldReceive: Bool?");
    expect(watchState).toMatch(
      /let canReceive = session\.isPaired && session\.isWatchAppInstalled\s*if canReceive, self\.couldReceive == false \{ self\.resendLastSnapshot\(\) \}\s*self\.couldReceive = canReceive[\s\S]*?self\.flushIfActivated\(session\)/,
    );
    expect(activation).toContain(
      "self.couldReceive = session.isPaired && session.isWatchAppInstalled",
    );
  });

  it("restores what publishSnapshot stored and forces a transfer", () => {
    expect(resend).toContain(
      "if latestJSON == nil { latestJSON = Self.storedSnapshot() }",
    );
    expect(resend).toMatch(
      /if latestJSON != nil \{ shouldTransferLatest = true \}/,
    );
    expect(stored).toContain("string(forKey: conPawsSnapshotKey)");
    expect(stored).toContain(
      "ConPawsWidgetsModule.supportedSchemaVersions.contains(schemaVersion)",
    );
    // The slot holds the exact JSON last handed to the bridge.
    expect(publish).toMatch(
      /defaults\.set\(json, forKey: key\)[\s\S]*?self\.watchBridge\.publish\(json,/,
    );
  });
});
