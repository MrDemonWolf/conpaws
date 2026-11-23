import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo", () => ({ requireOptionalNativeModule: () => null }));
vi.mock("react-native", () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock("@/db/repositories/events", () => ({ getById: vi.fn() }));
vi.mock("@/db/repositories/conventions", () => ({ getById: vi.fn() }));
vi.mock("@/lib/reminder-default-storage", () => ({
  getDefaultReminderMinutes: vi.fn(),
}));
vi.mock("./event-schedule", () => ({}));
vi.mock("./widget-snapshot", () => ({}));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

const {
  WATCH_COMMAND_EVENT,
  WATCH_COMMAND_MAX_AGE_MS,
  WATCH_COMMAND_MAX_ID_LENGTH,
} = await import("./watch-commands");

/**
 * A Watch command crosses three codebases that no compiler checks against
 * each other: the Watch encodes it (targets/_shared, compiled into the Watch),
 * the phone's pod validates and queues it, and JS applies it. A key or action
 * spelled differently on one side drops every tap without an error anywhere,
 * so this reads all three and holds them together.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), "utf8");
const shared = read("../../targets/_shared/ConPawsSnapshot.swift");
const store = read("../../targets/watch/WatchScheduleStore.swift");
const module = read(
  "../../modules/conpaws-widgets/ios/ConPawsWidgetsModule.swift",
);
const commands = read("./watch-commands.ts");

const sharedCommand =
  shared.match(/struct ConPawsWatchCommand[\s\S]*?\n\}/)?.[0] ?? "";

describe("Watch command contract", () => {
  it("uses one message key on the Watch and the phone", () => {
    const key = sharedCommand.match(/static let messageKey = "([^"]+)"/)?.[1];
    expect(key).toBe("conpaws.watch.command.v1");
    expect(module).toContain(`private let conPawsWatchCommandKey = "${key}"`);
    expect(store).toContain("ConPawsWatchCommand.messageKey");
  });

  it("agrees on the actions", () => {
    const swiftActions = [
      ...(
        sharedCommand.match(/enum Action[^{]*\{([\s\S]*?)\}/)?.[1] ?? ""
      ).matchAll(/case (\w+)/g),
    ].map((match) => match[1]);
    expect(swiftActions).toEqual(["save", "remove"]);
    expect(module).toContain('["save", "remove"].contains(action)');
    expect(commands).toContain('action !== "save" && action !== "remove"');
  });

  it("agrees on the fields", () => {
    for (const field of ["id", "conventionId", "eventId", "sentAtMs"]) {
      expect(sharedCommand).toMatch(new RegExp(`let ${field}: `));
      expect(module).toContain(`object["${field}"]`);
    }
  });

  it("agrees on the id length and the age limit", () => {
    expect(sharedCommand).toContain(
      `static let maxIdentifierLength = ${WATCH_COMMAND_MAX_ID_LENGTH}`,
    );
    expect(module).toContain(`length < ${WATCH_COMMAND_MAX_ID_LENGTH}`);
    const maxAgeSeconds = Number(
      sharedCommand
        .match(/static let maxAge: TimeInterval = ([\d_]+)/)?.[1]
        ?.replace(/_/g, ""),
    );
    expect(maxAgeSeconds * 1000).toBe(WATCH_COMMAND_MAX_AGE_MS);
  });

  it("names the native event and the queue functions JS calls", () => {
    expect(module).toContain(`Events("${WATCH_COMMAND_EVENT}")`);
    expect(module).toContain(`sendEvent("${WATCH_COMMAND_EVENT}"`);
    expect(module).toContain('Function("peekWatchCommands")');
    expect(module).toContain('Function("acknowledgeWatchCommands")');
    expect(commands).toContain("peekWatchCommands?.()");
    expect(commands).toContain("acknowledgeWatchCommands?.(");
  });

  it("lists handled commands under one key on the phone and the Watch", () => {
    expect(shared).toMatch(/var handledCommandIds: \[String\]\?/);
    expect(read("./watch-snapshot.ts")).toContain(
      "{ handledCommandIds: [...ids] }",
    );
    expect(sharedCommand).toContain("snapshot.handledCommandIds");
  });

  it("starts WatchConnectivity at launch, before React Native", () => {
    const config = JSON.parse(
      read("../../modules/conpaws-widgets/expo-module.config.json"),
    ) as { apple: { appDelegateSubscribers: string[] } };
    expect(config.apple.appDelegateSubscribers).toContain(
      "ConPawsWatchSubscriber",
    );
    expect(module).toMatch(
      /class ConPawsWatchSubscriber: ExpoAppDelegateSubscriber[\s\S]*?ConPawsWatchBridge\.shared\.activate\(\)/,
    );
  });

  it("sends snapshots as UTF-8 data, which is what the size guard measures", () => {
    expect(module).toContain("Data(latestJSON.utf8)");
    expect(store).toContain("(value as? Data)");
  });

  it("implements every WatchConnectivity entry point a command can use", () => {
    expect(module).toMatch(/didReceiveMessage message: \[String: Any\]\)/);
    expect(module).toMatch(
      /didReceiveMessage message: \[String: Any\],\s*replyHandler:/,
    );
    expect(module).toMatch(/didReceiveUserInfo userInfo:/);
    expect(store).toContain("sendMessage(");
    expect(store).toContain("transferUserInfo(payload)");
    // A failed transfer is sent again rather than left pending for a day.
    expect(store).toMatch(
      /didFinish userInfoTransfer: WCSessionUserInfoTransfer/,
    );
    expect(store).toContain("func sessionReachabilityDidChange(");
  });
});
