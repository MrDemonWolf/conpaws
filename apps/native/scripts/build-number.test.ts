import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bumpBuildNumber,
  ciBuildNumber,
  describeAppleTargetDrift,
  describeDrift,
  describeVariantRisk,
  missingSigningProperties,
  parseBuildNumber,
  parseGradleVersionCode,
  parseInfoPlistBuildNumber,
  parseInfoPlistVariant,
  setBuildNumber,
} from "./build-number.mjs";

it("assigns CI numbers without touching the public version or reusing a rerun", () => {
  const source = 'const BUILD_NUMBER = 207;\nconst version = "1.0.0";';
  expect(ciBuildNumber("1", "1")).toBe(1001);
  expect(ciBuildNumber("2", "1")).toBe(1002);
  expect(ciBuildNumber("8999", "1")).toBe(9999);
  expect(setBuildNumber(source, 1001)).toBe(source.replace("207", "1001"));
  for (const value of ["0", "abc", "1.5", "9000"]) {
    expect(() => ciBuildNumber(value, "1")).toThrow();
  }
  expect(() => ciBuildNumber("1", "2")).toThrow(/new Native release/);
  for (const value of [207, 206, 10000, "abc", "1.5", undefined]) {
    expect(() => setBuildNumber(source, value)).toThrow();
  }
});

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

describe("missingSigningProperties", () => {
  const keys = [
    "android.injected.signing.store.file",
    "android.injected.signing.store.password",
    "android.injected.signing.key.alias",
    "android.injected.signing.key.password",
  ];

  it("requires all four properties by key presence without reading values", () => {
    expect(
      missingSigningProperties(`${keys[0]}=secret-path\n${keys[1]}=x\n`),
    ).toEqual(keys.slice(2));
    expect(
      missingSigningProperties(keys.map((key) => `${key}=\n`).join("\n")),
    ).toEqual([]);
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

describe("describeAppleTargetDrift", () => {
  const companions = [
    ["widget", "com.mrdemonwolf.conpaws.widgets"],
    ["ConPawsWatch", "com.mrdemonwolf.conpaws.watchkitapp"],
    [
      "ConPawsWatchWidgetExtension",
      "com.mrdemonwolf.conpaws.watchkitapp.widgets",
    ],
  ].flatMap(([target, bundleIdentifier]) =>
    ["Debug", "Release"].map((name) => ({
      target,
      name,
      bundleIdentifier,
      buildNumber: 209,
    })),
  );

  it("accepts matching companion numbers in every configuration", () => {
    expect(describeAppleTargetDrift(209, companions)).toEqual([]);
  });

  it("rejects a stale Watch extension even when the main app plist matches", () => {
    expect(describeDrift(209, [{ label: "main app", value: 209 }])).toEqual([]);
    expect(
      describeAppleTargetDrift(209, [
        ...companions.slice(0, -1),
        { ...companions.at(-1), buildNumber: 208 },
      ]),
    ).toEqual([
      "ConPawsWatchWidgetExtension (Release) CURRENT_PROJECT_VERSION is 208, app.config.ts says 209",
    ]);
  });

  it("ignores the main app's unused setting and unrelated configurations", () => {
    expect(
      describeAppleTargetDrift(209, [
        { target: "project", name: "Release", buildNumber: 1 },
        {
          target: "ConPaws",
          name: "Release",
          bundleIdentifier: "com.mrdemonwolf.conpaws",
          buildNumber: 1,
        },
        {
          target: "ConPaws",
          name: "Debug",
          bundleIdentifier: "com.mrdemonwolf.conpaws.dev",
          buildNumber: 1,
        },
        {
          target: "OtherApp",
          name: "Release",
          bundleIdentifier: "com.mrdemonwolf.conpaws-other.widgets",
          buildNumber: 1,
        },
      ]),
    ).toEqual([]);
  });

  it("accepts quoted settings and development companion bundle IDs", () => {
    expect(
      describeAppleTargetDrift(209, [
        {
          ...companions[0],
          bundleIdentifier: '"com.mrdemonwolf.conpaws.dev.widgets"',
          buildNumber: '"209"',
        },
      ]),
    ).toEqual([]);
  });

  it("rejects missing or unresolved companion build numbers", () => {
    for (const buildNumber of [undefined, "$(MISSING_NUMBER)"]) {
      expect(
        describeAppleTargetDrift(209, [{ ...companions[0], buildNumber }]),
      ).toHaveLength(1);
    }
    expect(describeAppleTargetDrift(209, [])).toEqual([]);
  });
});

describe("parseInfoPlistVariant", () => {
  it("reads the variant marker", () => {
    expect(
      parseInfoPlistVariant(
        "<key>ConPawsBuildVariant</key>\n\t<string>preview</string>",
      ),
    ).toBe("preview");
  });

  it("returns null for prebuild output that predates the key", () => {
    expect(parseInfoPlistVariant("<key>CFBundleVersion</key>")).toBeNull();
  });
});

describe("describeVariantRisk", () => {
  it("passes a production build", () => {
    expect(describeVariantRisk("production", "production", false)).toEqual([]);
  });

  it("passes prebuild output that predates the marker", () => {
    expect(describeVariantRisk(null, undefined, false)).toEqual([]);
  });

  it("catches APP_VARIANT=preview before prebuild has run", () => {
    expect(describeVariantRisk(null, "preview", false)).toHaveLength(1);
  });

  it("catches native output already prebuilt as preview", () => {
    expect(describeVariantRisk("preview", undefined, false)).toHaveLength(1);
  });

  it("reports both signals separately", () => {
    expect(describeVariantRisk("preview", "preview", false)).toHaveLength(2);
  });

  it("honours the owner-QA escape hatch", () => {
    expect(describeVariantRisk("preview", "preview", true)).toEqual([]);
  });
});
