import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const nativeRoot = path.resolve(__dirname, "../..");

/**
 * Layout follows the window, never the device. An iPad in a narrow Split View
 * pane, a Stage Manager window, the unfolded iPhone Duo and an Android
 * foldable all need the layout their window has room for, and a device check
 * gets every one of them wrong. `lib/content-width.ts` is the one place that
 * decides, from `useWindowDimensions()`.
 */
const FORBIDDEN: Array<[string, RegExp]> = [
  ["Platform.isPad", /\bPlatform\s*\.\s*isPad\b/],
  ['Dimensions.get("screen")', /Dimensions\s*\.\s*get\(\s*["'`]screen["'`]/],
  ["expo-device DeviceType", /\bDeviceType\b/],
  ["userInterfaceIdiom", /\buserInterfaceIdiom\b/],
  ["ScreenOrientation.lockAsync", /\block(?:Platform)?Async\s*\(/],
  ["requireFullScreen", /\brequireFullScreen\b/],
];

function sourceFiles(): string[] {
  return ["app", "src"]
    .flatMap((dir) =>
      (
        readdirSync(path.join(nativeRoot, dir), { recursive: true }) as string[]
      ).map((file) => path.join(nativeRoot, dir, file)),
    )
    .filter(
      (file) =>
        /\.[cm]?[jt]sx?$/.test(file) &&
        !/\.d\.ts$/.test(file) &&
        // Test files name these patterns in order to forbid them.
        !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file),
    );
}

describe("layout is device-agnostic", () => {
  it("scans the app's sources", () => {
    expect(sourceFiles().length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN)("no source uses %s", (_name, pattern) => {
    const offenders = sourceFiles()
      .filter((file) => pattern.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(nativeRoot, file));
    expect(offenders).toEqual([]);
  });

  it("keeps the app rotatable and resizable on iPad", () => {
    const config = readFileSync(path.join(nativeRoot, "app.config.ts"), "utf8");
    // A fixed orientation would lock phones and iPads to one shape.
    expect(config).toMatch(/\borientation:\s*["']default["']/);
    expect(config).toMatch(/\bsupportsTablet:\s*true\b/);
    // UIRequiresFullScreen opts out of Split View and Stage Manager.
    expect(config).not.toMatch(/\brequireFullScreen\b/);
    expect(config).not.toMatch(/\bUIRequiresFullScreen\b/);
  });
});
