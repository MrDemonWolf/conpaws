import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bumpBuildNumber,
  describeDrift,
  parseBuildNumber,
  parseGradleVersionCode,
  parseInfoPlistBuildNumber,
} from "./build-number.mjs";

describe("parseBuildNumber", () => {
  it("reads the declaration", () => {
    expect(parseBuildNumber("const BUILD_NUMBER = 205;\n")).toBe(205);
  });

  it("ignores build numbers cited in comments", () => {
    const source = [
      "// Deleting this key got build 204 rejected with ITMS-90683.",
      "const BUILD_NUMBER = 205;",
      "// 203's archive shipped both.",
    ].join("\n");
    expect(parseBuildNumber(source)).toBe(205);
    expect(bumpBuildNumber(source).source).toBe(
      source.replace("const BUILD_NUMBER = 205;", "const BUILD_NUMBER = 206;"),
    );
  });

  it("throws when the declaration is missing", () => {
    expect(() => parseBuildNumber("const OTHER = 1;")).toThrow(/BUILD_NUMBER/);
  });

  it("reads the real app.config.ts", async () => {
    const source = await readFile(
      path.join(__dirname, "../app.config.ts"),
      "utf8",
    );
    expect(parseBuildNumber(source)).toBeGreaterThanOrEqual(205);
  });
});

describe("bumpBuildNumber", () => {
  it("increments by one and leaves the rest of the file alone", () => {
    const source = 'const BUILD_NUMBER = 205;\nconst name = "ConPaws";\n';
    const result = bumpBuildNumber(source);
    expect(result).toMatchObject({ current: 205, next: 206 });
    expect(result.source).toBe(
      'const BUILD_NUMBER = 206;\nconst name = "ConPaws";\n',
    );
  });
});

describe("native project parsers", () => {
  it("reads CFBundleVersion", () => {
    const xml =
      "<key>CFBundleShortVersionString</key>\n\t<string>1.0.0</string>\n\t<key>CFBundleVersion</key>\n\t<string>204</string>";
    expect(parseInfoPlistBuildNumber(xml)).toBe(204);
  });

  it("reads versionCode without matching versionName", () => {
    const gradle = "        versionCode 204\n        versionName '1.0.0'\n";
    expect(parseGradleVersionCode(gradle)).toBe(204);
  });

  it("returns null when the value is absent", () => {
    expect(parseInfoPlistBuildNumber("<dict></dict>")).toBeNull();
    expect(parseGradleVersionCode("android { }")).toBeNull();
  });
});

describe("describeDrift", () => {
  it("reports only generated projects that disagree", () => {
    const drift = describeDrift(205, [
      { label: "ios", value: 204 },
      { label: "android", value: 205 },
    ]);
    expect(drift).toEqual(["ios is 204, app.config.ts says 205"]);
  });

  it("treats an absent native project as nothing to report", () => {
    expect(
      describeDrift(205, [
        { label: "ios", value: null },
        { label: "android", value: null },
      ]),
    ).toEqual([]);
  });
});
