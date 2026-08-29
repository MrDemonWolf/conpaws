import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveQuickActionRoute } from "./quick-action-routes";

/**
 * The quick-action routes exist twice: as plain strings in the Swift
 * subscriber and as typed Hrefs in quick-action-routes.ts. TypeScript catches
 * drift on the TS side; a Swift-side typo only surfaced as a runtime
 * reportMessage on a user's phone. This test reads the Swift source and holds
 * both sides to each other.
 */
const swiftSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../modules/conpaws-widgets/ios/ConPawsQuickActionsSubscriber.swift",
  ),
  "utf8",
);

describe("quick-action route contract", () => {
  // Route strings in the Swift file look like: return "/schedule"
  const swiftRoutes = [
    ...new Set(
      [...swiftSource.matchAll(/"(\/[a-z0-9/-]+)"/gi)].map((match) => match[1]),
    ),
  ];

  it("found the Swift route table", () => {
    expect(swiftRoutes.length).toBeGreaterThanOrEqual(3);
  });

  it.each(swiftRoutes)("Swift route %s resolves to a typed route", (route) => {
    expect(resolveQuickActionRoute(route)).not.toBeNull();
  });

  it("rejects unknown paths", () => {
    expect(resolveQuickActionRoute("/nope")).toBeNull();
    expect(resolveQuickActionRoute(null)).toBeNull();
  });
});
