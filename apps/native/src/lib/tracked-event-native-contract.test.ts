import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  TRACKED_EVENT_ACTIVITY_NAME,
  TRACKED_EVENT_STOP_TARGET,
} from "./tracked-event.types";

/**
 * The Live Activity's Stop button is handled natively so it works when the app
 * was not running. That Swift code repeats strings and a type from expo-widgets
 * that no compiler checks across the module boundary: an expo-widgets upgrade
 * that renames its notification or reshapes its attributes would leave Stop
 * silently doing nothing. This test reads both sides and holds them together.
 */
const here = dirname(fileURLToPath(import.meta.url));
const moduleRoot = resolve(here, "../../modules/conpaws-widgets");
const stopSource = readFileSync(
  resolve(moduleRoot, "ios/ConPawsTrackedEventStop.swift"),
  "utf8",
);
const expoWidgetsIos = resolve(
  dirname(createRequire(import.meta.url).resolve("expo-widgets/package.json")),
  "ios",
);
const readExpoWidgets = (file: string) =>
  readFileSync(resolve(expoWidgetsIos, file), "utf8");

function swiftConstant(source: string, name: string): string | undefined {
  return source.match(new RegExp(`static let ${name} = "([^"]+)"`))?.[1];
}

/** Stored properties of a Swift struct body, in order, whitespace-normalized. */
function storedProperties(body: string): string[] {
  return [...body.matchAll(/^\s*var (\w+): ([\w?]+)\s*$/gm)].map(
    (match) => `${match[1]}: ${match[2]}`,
  );
}

function attributesShape(source: string) {
  const outer = source.match(
    /struct LiveActivityAttributes: ActivityAttributes \{([\s\S]*?)\n\}/,
  )?.[1];
  const state = outer?.match(
    /struct ContentState: Codable, Hashable \{([\s\S]*?)\}/,
  )?.[1];
  if (outer === undefined || state === undefined) return undefined;
  const outerWithoutState = outer.replace(state, "");
  return {
    attributes: storedProperties(outerWithoutState),
    contentState: storedProperties(state),
  };
}

describe("tracked-event native contract (Apple)", () => {
  it("matches the TS stop target and activity name", () => {
    expect(swiftConstant(stopSource, "stopTarget")).toBe(
      TRACKED_EVENT_STOP_TARGET,
    );
    expect(swiftConstant(stopSource, "activityName")).toBe(
      TRACKED_EVENT_ACTIVITY_NAME,
    );
  });

  it("listens for the notification expo-widgets posts button presses under", () => {
    const widgetsModule = readExpoWidgets("WidgetsModule.swift");
    const nameConstant = widgetsModule.match(
      /let onUserInteractionNotification = Notification\.Name\((\w+)\)/,
    )?.[1];
    expect(nameConstant).toBeDefined();
    const literal = widgetsModule.match(
      new RegExp(`let ${nameConstant} = "([^"]+)"`),
    )?.[1];
    expect(literal).toBeDefined();
    expect(stopSource).toContain(`Notification.Name("${literal}")`);

    // The intent must still post through that name with the target in
    // userInfo["eventData"], which is what the native handler reads.
    const events = readExpoWidgets("WidgetsEvents.swift");
    expect(events).toContain("name: onUserInteractionNotification");
    expect(events).toContain('["eventData": eventData]');
    const intent = readExpoWidgets("Widgets/AppIntent.swift");
    expect(intent).toMatch(
      /struct LiveActivityUserInteraction: LiveActivityIntent[\s\S]*?"target": target/,
    );
  });

  it("mirrors expo-widgets' Live Activity attributes type", () => {
    const ours = attributesShape(stopSource);
    const theirs = attributesShape(
      readExpoWidgets("Widgets/WidgetLiveActivity.swift"),
    );
    expect(ours).toEqual({
      attributes: ["url: String?"],
      contentState: ["name: String", "props: String?"],
    });
    expect(theirs).toEqual(ours);
  });

  it("registers the subscriber that observes Stop before JS loads", () => {
    const config = JSON.parse(
      readFileSync(resolve(moduleRoot, "expo-module.config.json"), "utf8"),
    );
    expect(config.apple.appDelegateSubscribers).toContain(
      "ConPawsTrackedEventSubscriber",
    );
    expect(config.apple.appDelegateSubscribers).toContain(
      "ConPawsQuickActionsSubscriber",
    );
  });

  it("exposes the consume function JS calls", () => {
    const moduleSource = readFileSync(
      resolve(moduleRoot, "ios/ConPawsWidgetsModule.swift"),
      "utf8",
    );
    expect(moduleSource).toContain(
      'Function("consumePendingTrackedEventStop")',
    );
  });
});

/**
 * The Android presenter reaches Kotlin through optional calls, so a renamed
 * native function would not fail to build: Stop in the app would quietly leave
 * the notification up. The receiver behind the notification's own Stop button
 * is one manifest line that nothing else refers to.
 */
describe("tracked-event native contract (Android)", () => {
  const androidRoot = resolve(moduleRoot, "android/src/main");
  const kotlinModule = readFileSync(
    resolve(
      androidRoot,
      "java/expo/modules/conpawswidgets/ConPawsWidgetsModule.kt",
    ),
    "utf8",
  );
  const presenter = readFileSync(
    resolve(here, "../services/tracked-event-presenter.android.ts"),
    "utf8",
  );

  it("declares every native function the presenter calls", () => {
    const called = new Set(
      [...presenter.matchAll(/nativeModule\??\.(\w+TrackedEvent\w*)/g)].map(
        (match) => match[1],
      ),
    );
    expect([...called].sort()).toEqual([
      "dismissTrackedEvent",
      "presentTrackedEvent",
      "readTrackedEventPresentation",
      "restoreTrackedEvent",
      "updateTrackedEvent",
    ]);
    for (const name of called) {
      expect(kotlinModule).toContain(`AsyncFunction("${name}")`);
    }
  });

  it("sends the stop event under the name the presenter listens for", () => {
    const listened = presenter.match(/addListener\("(\w+)"/)?.[1];
    expect(listened).toBe("onTrackedEventStop");
    expect(kotlinModule).toContain(`Events("${listened}")`);
  });

  it("registers the Stop receiver, closed to other apps", () => {
    const manifest = readFileSync(
      resolve(androidRoot, "AndroidManifest.xml"),
      "utf8",
    );
    expect(manifest).toMatch(
      /<receiver android:name="\.ConPawsTrackedEventReceiver" android:exported="false" \/>/,
    );
  });
});
