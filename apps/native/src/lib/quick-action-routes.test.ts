import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveQuickActionRoute } from "./quick-action-routes";

/**
 * The quick-action routes exist twice: as plain strings in the Swift
 * native modules and as typed Hrefs in quick-action-routes.ts. TypeScript catches
 * drift on the TS side; a native-side typo only surfaced as a runtime
 * reportMessage on a user's phone. This test reads the native sources and holds
 * both sides to each other.
 */
const nativeRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../modules/conpaws-widgets",
);

describe.each([
  ["Apple", "ios/ConPawsQuickActionsModule.swift"],
  [
    "Android",
    "android/src/main/java/expo/modules/conpawswidgets/ConPawsQuickActionsModule.kt",
  ],
])("%s quick-action route contract", (_, sourceFile) => {
  const source = readFileSync(resolve(nativeRoot, sourceFile), "utf8");
  const nativeRoutes = [
    ...new Set(
      [...source.matchAll(/"(\/[a-z0-9/-]+)"/gi)].map((match) => match[1]),
    ),
  ];

  it("offers exactly the four shipped tasks", () => {
    expect(nativeRoutes).toHaveLength(4);
  });

  it.each(nativeRoutes)(
    "native route %s resolves to a typed route",
    (route) => {
      expect(resolveQuickActionRoute(route)).not.toBeNull();
    },
  );

  it("rejects unknown paths", () => {
    expect(resolveQuickActionRoute("/nope")).toBeNull();
    expect(resolveQuickActionRoute("toString")).toBeNull();
    expect(resolveQuickActionRoute("constructor")).toBeNull();
    expect(resolveQuickActionRoute("https://example.com/schedule")).toBeNull();
    expect(resolveQuickActionRoute(null)).toBeNull();
  });
});

it("keeps the widget bridge Apple-only when registering Android shortcuts", () => {
  const config = JSON.parse(
    readFileSync(resolve(nativeRoot, "expo-module.config.json"), "utf8"),
  );
  expect(config.apple.modules).toContain("ConPawsWidgetsModule");
  expect(config.apple.modules).toContain("ConPawsQuickActionsModule");
  expect(config.android.modules).toEqual([
    "expo.modules.conpawswidgets.ConPawsQuickActionsModule",
  ]);
});
