import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfigContext } from "expo/config";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/db/repositories/events", () => ({}));
vi.mock("@/db/repositories/conventions", () => ({}));
vi.mock("i18next", () => ({ default: { isInitialized: false } }));

const { REMINDER_CATEGORY_IDENTIFIER, REMINDER_NOTIFICATION_KIND } =
  await import("./notifications");

/**
 * A panel reminder crosses two codebases no compiler checks against each
 * other: the phone files it (notifications.ts) and the Watch app reads it
 * back when it is tapped on the wrist (targets/_shared, compiled only into
 * the Watch). A category, kind or key spelled differently on one side opens
 * the home screen instead of the panel, with no error anywhere. CI compiles
 * no Watch Swift, so the Watch's wiring is held here as text too.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), "utf8");
const watchReader = read(
  "../../targets/_shared/ConPawsReminderNotification.swift",
);
const phone = read("./notifications.ts");
const app = read("../../targets/watch/index.swift");
const delegate = read("../../targets/watch/WatchAppDelegate.swift");
const content = read("../../targets/watch/ContentView.swift");

const swiftConstant = (name: string) =>
  watchReader.match(new RegExp(`static let ${name} = "([^"]+)"`))?.[1];

describe("reminder notification contract", () => {
  it("names the reminder category the same on the phone and the Watch", () => {
    expect(REMINDER_CATEGORY_IDENTIFIER).toBe("conpaws.reminder");
    expect(swiftConstant("categoryIdentifier")).toBe(
      REMINDER_CATEGORY_IDENTIFIER,
    );
  });

  it("agrees on the reminder's kind and the keys that carry its panel", () => {
    expect(swiftConstant("kind")).toBe(REMINDER_NOTIFICATION_KIND);
    expect(swiftConstant("kindKey")).toBe("kind");
    expect(swiftConstant("eventKey")).toBe("eventId");
    expect(swiftConstant("conventionKey")).toBe("conventionId");
    expect(phone).toMatch(
      /data: \{\s*kind: REMINDER_NOTIFICATION_KIND,\s*eventId: event\.id,\s*conventionId: /,
    );
  });

  it("has the Watch app push a tapped reminder's panel onto its stack", () => {
    expect(app).toContain(
      "@WKApplicationDelegateAdaptor private var appDelegate: WatchAppDelegate",
    );
    expect(app).toContain(
      "ContentView(store: store, reminders: appDelegate.reminders)",
    );
    expect(delegate).toContain(
      "UNUserNotificationCenter.current().delegate = self",
    );
    expect(delegate).toContain("UNNotificationDefaultActionIdentifier");
    expect(delegate).toContain("ConPawsReminderNotification.link(");
    // Without it watchOS silences a reminder while the app is frontmost.
    expect(delegate).toContain("willPresent notification: UNNotification");
    // Pushed onto the same path a complication link sets, after waiting
    // for a cold launch's schedule, not presented over it.
    expect(watchReader).toContain(
      "WatchRoute.path(opening: link, in: snapshot)",
    );
    expect(content).toContain("ConPawsPendingReminderTap(link: link");
    expect(content).toMatch(/case \.open\(let opened\):\s*path = opened/);
    expect(content).not.toContain(".sheet(");
  });

  // A delegate `handle(_:)` takes every background task from the scene's
  // `.backgroundTask(.watchConnectivity)`, and the complication stops
  // updating while the app is closed.
  it("leaves background tasks with the scene", () => {
    expect(delegate).not.toMatch(/func handle\(/);
    expect(app).toContain(".backgroundTask(.watchConnectivity)");
  });
});

describe("Time Sensitive entitlement", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["development", "preview", "production"] as const)(
    "lets the %s iPhone app file Time Sensitive reminders",
    async (variant) => {
      vi.resetModules();
      vi.stubEnv("APP_VARIANT", variant);
      const { default: createConfig } = await import("../../app.config");
      const config = createConfig({ config: {} } as ConfigContext);

      expect(
        config.ios?.entitlements?.[
          "com.apple.developer.usernotifications.time-sensitive"
        ],
      ).toBe(true);
    },
  );
});
