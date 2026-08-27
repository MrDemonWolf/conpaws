import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * These two routes are the only places that refresh the Home Screen widget
 * after a write, and the ordering is what makes the refresh visible: the
 * snapshot has to be rebuilt while the screen is still up, before the user is
 * moved on or told the import worked.
 *
 * There is no way to run them here. They are `.tsx` route modules pulling in
 * React Native and expo-router, and this suite runs under `environment: "node"`
 * with no renderer, so the ordering is read out of the source instead.
 *
 * That makes this a source lint wearing a test's clothes, and it is written to
 * fail loudly rather than quietly: every anchor is a whitespace-insensitive
 * pattern, and a missing one throws with the name of the invariant it belongs
 * to instead of degrading into an assertion that cannot fail. The real fix is
 * to lift these commit sequences into plain async functions under
 * `src/services/` and assert `mock.invocationCallOrder` on them.
 */
const createSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/(home)/convention/create.tsx"),
  "utf8",
);
const importSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/(home)/convention/[id]/import.tsx"),
  "utf8",
);

/**
 * Position of `pattern`, or a failure naming what went missing. Returning -1
 * here is what let a renamed anchor silently turn the ordering assertions into
 * comparisons against the top of the file.
 */
function anchor(
  source: string,
  label: string,
  pattern: RegExp,
  from = 0,
): number {
  const match = source.slice(from).match(pattern);
  if (match?.index === undefined) {
    throw new Error(
      `Could not find ${label} in the route source. The step it anchors may have been renamed or removed; re-point this test at whatever replaced it rather than deleting the ordering check.`,
    );
  }
  return from + match.index;
}

describe("widget snapshot publication routes", () => {
  it("publishes a manually created convention before navigating away", () => {
    const write = anchor(
      createSource,
      "the convention insert",
      /conventionsRepo\.create\(/,
    );
    const publish = anchor(
      createSource,
      "the widget snapshot publish",
      /publishWidgetSnapshot\(/,
      write,
    );
    const navigation = anchor(
      createSource,
      "the navigation to the new convention",
      /router\.replace\(/,
      write,
    );

    expect(publish).toBeGreaterThan(write);
    expect(navigation).toBeGreaterThan(publish);
  });

  it("seeds the created convention and its empty event list before navigation", () => {
    const write = anchor(
      createSource,
      "the convention insert",
      /conventionsRepo\.create\(/,
    );
    const conventionCache = anchor(
      createSource,
      'the seeded ["convention", id] cache entry',
      /setQueryData\(\s*\["convention",/,
      write,
    );
    const eventCache = anchor(
      createSource,
      'the seeded ["events", id] cache entry',
      /setQueryData\(\s*\["events",/,
      write,
    );
    const navigation = anchor(
      createSource,
      "the navigation to the new convention",
      /router\.replace\(/,
      write,
    );

    expect(conventionCache).toBeGreaterThan(write);
    expect(eventCache).toBeGreaterThan(write);
    expect(navigation).toBeGreaterThan(Math.max(conventionCache, eventCache));
  });

  it("publishes updated convention metadata after an existing schedule import", () => {
    const metadataUpdate = anchor(
      importSource,
      "the convention metadata update",
      /conventionsRepo\.update\(/,
    );
    const publish = anchor(
      importSource,
      "the widget snapshot publish",
      /publishWidgetSnapshot\(/,
      metadataUpdate,
    );
    const successAlert = anchor(
      importSource,
      "the import success alert",
      /Alert\.alert\(\s*t\("import\.alerts\.successTitle"\)/,
      metadataUpdate,
    );

    expect(publish).toBeGreaterThan(metadataUpdate);
    expect(successAlert).toBeGreaterThan(publish);
  });

  it("fails with a readable message when an anchor goes missing", () => {
    // Guards the guard: the helper above is only worth having if a vanished
    // anchor stops the suite instead of quietly restarting the search at zero.
    expect(() =>
      anchor(createSource, "a step that does not exist", /neverWrittenHere\(/),
    ).toThrow(/Could not find a step that does not exist/);
  });
});
