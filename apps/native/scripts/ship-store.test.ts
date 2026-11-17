import { describe, expect, it } from "vitest";
import {
  archiveProblems,
  buildExportOptions,
  bundleProblems,
  guardProblems,
  parseArgs,
  releaseCiState,
  TRACKS,
  UPLOAD_CERT_SHA256,
  uploadedBuildNumbers,
} from "./ship-store.mjs";

const clean = {
  dirty: false,
  releaseCi: { active: false, reason: "" },
  expectedVariant: "preview",
  generatedVariant: "preview",
  buildNumberCheck: { ok: true, message: "" },
};

describe("parseArgs", () => {
  it("defaults iOS to internal-only TestFlight and Android to internal testing", () => {
    expect(parseArgs(["ios"]).trackConfig).toBe(TRACKS.ios.testflight);
    expect(parseArgs(["android"]).trackConfig).toBe(TRACKS.android.internal);
  });

  it("keeps preview internal and public production", () => {
    expect(TRACKS.ios.testflight).toMatchObject({
      variant: "preview",
      internalOnly: true,
    });
    expect(TRACKS.ios.public).toMatchObject({
      variant: "production",
      internalOnly: false,
    });
    expect(TRACKS.android.internal.variant).toBe("preview");
    expect(TRACKS.android.public.variant).toBe("production");
  });

  it("rejects unknown platforms, tracks and options", () => {
    expect(() => parseArgs(["web"])).toThrow(/ios or android/);
    expect(() => parseArgs(["ios", "--track", "appstore"])).toThrow(
      /testflight or public/,
    );
    expect(() => parseArgs(["ios", "--force"])).toThrow(/Unknown option/);
    expect(() => parseArgs(["android", "--dry-run"])).toThrow(/never uploads/);
    expect(() => parseArgs(["android", "--archive", "x"])).toThrow(
      /only applies to ios/,
    );
  });
});

describe("releaseCiState", () => {
  it("treats a missing variable as off, the normal state before CI is configured", () => {
    expect(
      releaseCiState({
        ok: true,
        stdout: '[{"name":"OTHER","value":"true"}]',
        stderr: "",
      }),
    ).toEqual({
      active: false,
      reason: "",
    });
  });

  it("is on only for the exact value true", () => {
    const state = (value: string) =>
      releaseCiState({
        ok: true,
        stdout: JSON.stringify([{ name: "NATIVE_RELEASE_ENABLED", value }]),
        stderr: "",
      }).active;
    expect(state("true")).toBe(true);
    expect(state("false")).toBe(false);
  });

  it("is unknown when gh cannot answer, so the guard refuses", () => {
    const failed = releaseCiState({
      ok: false,
      stdout: "",
      stderr: "not logged in",
    });
    expect(failed.active).toBeNull();
    expect(guardProblems({ ...clean, releaseCi: failed }).join(" ")).toMatch(
      /Could not confirm/,
    );
    expect(
      releaseCiState({ ok: true, stdout: "oops", stderr: "" }).active,
    ).toBeNull();
  });
});

describe("guardProblems", () => {
  it("passes a clean, matching, checked tree", () => {
    expect(guardProblems(clean)).toEqual([]);
  });

  it("refuses when release CI owns uploads", () => {
    expect(
      guardProblems({ ...clean, releaseCi: { active: true, reason: "" } }).join(
        " ",
      ),
    ).toMatch(/Native release/);
  });

  it("refuses uncommitted changes, a wrong prebuild and a failed build-number check", () => {
    const problems = guardProblems({
      ...clean,
      dirty: true,
      generatedVariant: "production",
      buildNumberCheck: { ok: false, message: "ios says 210\n" },
    });
    expect(problems).toHaveLength(3);
    expect(problems[1]).toContain(
      "cd apps/native && APP_VARIANT=preview CONPAWS_ALLOW_PREVIEW=1 bun run prebuild",
    );
  });
});

describe("uploadedBuildNumbers", () => {
  it("reads every build number Xcode recorded as uploaded", () => {
    const xml = `<dict><key>Distributions</key><array>
      <dict><key>uploadedBuildNumber</key>
        <string>211</string></dict>
      <dict><key>uploadedBuildNumber</key><string>209</string></dict>
    </array></dict>`;
    expect(uploadedBuildNumbers(xml)).toEqual([211, 209]);
    expect(uploadedBuildNumbers("<dict/>")).toEqual([]);
  });
});

describe("buildExportOptions", () => {
  it("uploads preview as internal-only and never lets Xcode change the build number", () => {
    const plist = buildExportOptions({
      track: TRACKS.ios.testflight,
      dryRun: false,
    });
    expect(plist).toContain("<key>destination</key><string>upload</string>");
    expect(plist).toContain(
      "<key>method</key><string>app-store-connect</string>",
    );
    expect(plist).toContain("<key>testFlightInternalTestingOnly</key><true/>");
    expect(plist).toContain(
      "<key>manageAppVersionAndBuildNumber</key><false/>",
    );
  });

  it("lets a production build reach external groups, and a dry run only export", () => {
    const plist = buildExportOptions({
      track: TRACKS.ios.public,
      dryRun: true,
    });
    expect(plist).toContain("<key>testFlightInternalTestingOnly</key><false/>");
    expect(plist).toContain("<key>destination</key><string>export</string>");
  });
});

describe("archiveProblems", () => {
  const bundle = (id: string, build = "212", version = "1.0.0") => ({
    CFBundleIdentifier: id,
    CFBundleVersion: build,
    CFBundleShortVersionString: version,
  });
  const bundles = [
    { ...bundle("com.mrdemonwolf.conpaws"), ConPawsBuildVariant: "production" },
    bundle("com.mrdemonwolf.conpaws.widgets"),
    bundle("com.mrdemonwolf.conpaws.watchkitapp"),
    bundle("com.mrdemonwolf.conpaws.watchkitapp.widgets"),
  ];

  it("accepts a consistent production archive", () => {
    expect(
      archiveProblems({
        bundles,
        expoVariant: "production",
        expectedVariant: "production",
        buildNumber: 212,
      }),
    ).toEqual([]);
  });

  it("catches a preview archive on the public path, from either variant source", () => {
    const problems = archiveProblems({
      bundles: [
        { ...bundles[0], ConPawsBuildVariant: "preview" },
        ...bundles.slice(1),
      ],
      expoVariant: "preview",
      expectedVariant: "production",
      buildNumber: 212,
    });
    expect(problems).toHaveLength(2);
  });

  it("catches a stale or missing Watch or widget target", () => {
    const problems = archiveProblems({
      bundles: [
        bundles[0],
        bundle("com.mrdemonwolf.conpaws.widgets", "211"),
        null,
        bundles[3],
      ],
      expoVariant: "production",
      expectedVariant: "production",
      buildNumber: 212,
    });
    expect(problems.join(" ")).toMatch(/expected 212/);
    expect(problems.join(" ")).toMatch(/missing/);
  });
});

describe("bundleProblems", () => {
  const config = {
    extra: { appVariant: "preview" },
    android: { package: "com.mrdemonwolf.conpaws" },
  };

  it("accepts the upload key, the package and the variant", () => {
    expect(
      bundleProblems({
        expoConfig: config,
        certificateSha256: UPLOAD_CERT_SHA256,
        expectedVariant: "preview",
      }),
    ).toEqual([]);
  });

  it("rejects a debug-signed, wrong-variant or wrong-package bundle", () => {
    expect(
      bundleProblems({
        expoConfig: {
          extra: { appVariant: "production" },
          android: { package: "com.example" },
        },
        certificateSha256: "AA:BB",
        expectedVariant: "preview",
      }),
    ).toHaveLength(3);
  });
});
