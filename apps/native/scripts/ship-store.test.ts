import { describe, expect, it } from "vitest";
import {
  archiveProblems,
  buildExportOptions,
  bundleProblems,
  guardProblems,
  localDay,
  meaningfulChanges,
  parseArgs,
  releaseCiState,
  sidecarProblems,
  TRACKS,
  UPLOAD_CERT_SHA256,
  uploadedBuildNumbers,
  uploadNumberProblem,
} from "./ship-store.mjs";

const listing = (variables: { name: string; value: string }[]) => ({
  ok: true,
  stdout: JSON.stringify(variables),
  stderr: "",
});

const clean = {
  tree: { ok: true, changes: [] as string[] },
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

  it("resolves --archive to an absolute path", () => {
    expect(parseArgs(["ios", "--archive", "x.xcarchive"]).archive).toMatch(
      /^\/.*x\.xcarchive$/,
    );
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

  it("parses the TestFlight distribution flags", () => {
    expect(
      parseArgs([
        "ios",
        "--track",
        "public",
        "--beta",
        "both",
        "--notes-file",
        "notes.txt",
      ]),
    ).toMatchObject({
      beta: "both",
      notesFile: expect.stringMatching(/^\/.*notes\.txt$/),
    });
    expect(
      parseArgs([
        "ios",
        "--track",
        "public",
        "--distribute-only",
        "--archive",
        "a.xcarchive",
        "--beta",
        "public",
        "--notes",
        "n",
      ]),
    ).toMatchObject({ distributeOnly: true, notes: "n" });
  });

  it("rejects distribution flags that cannot work", () => {
    expect(() => parseArgs(["ios", "--beta", "everyone"])).toThrow(
      /private, public or both/,
    );
    expect(() => parseArgs(["android", "--beta", "private"])).toThrow(
      /only apply to ios/,
    );
    expect(() => parseArgs(["ios", "--beta"])).toThrow(/needs a value/);
    expect(() => parseArgs(["ios", "--notes", "--yes"])).toThrow(
      /needs a value/,
    );
    expect(() =>
      parseArgs(["ios", "--notes", "a", "--notes-file", "b"]),
    ).toThrow(/not both/);
    expect(() =>
      parseArgs(["ios", "--distribute-only", "--beta", "private"]),
    ).toThrow(/needs --archive/);
    expect(() => parseArgs(["ios", "--dry-run", "--beta", "private"])).toThrow(
      /dry run/,
    );
  });
});

describe("meaningfulChanges", () => {
  const z = (...entries: string[]) => `${entries.join("\0")}\0`;

  it("ignores the Watch asset catalogs that prebuild regenerates", () => {
    expect(
      meaningfulChanges(
        z(
          " M apps/native/targets/watch/Assets.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png",
          " M apps/native/targets/watch-widget/Assets.xcassets/$accent.colorset/Contents.json",
        ),
      ),
    ).toEqual([]);
  });

  it("still counts real source changes, including other Watch files", () => {
    expect(
      meaningfulChanges(
        z(
          " M apps/native/targets/watch/content.swift",
          "?? apps/native/src/new.ts",
          " M apps/native/targets/watch/Assets.xcassets/AppIcon.appiconset/Contents.json",
        ),
      ),
    ).toEqual([
      " M apps/native/targets/watch/content.swift",
      "?? apps/native/src/new.ts",
    ]);
  });

  it("counts a rename out of a catalog, which -z reports as two paths", () => {
    expect(
      meaningfulChanges(
        z(
          "R  apps/native/src/x.swift",
          "apps/native/targets/watch/Assets.xcassets/x.swift",
        ),
      ),
    ).toEqual(["R  apps/native/src/x.swift"]);
  });
});

describe("releaseCiState", () => {
  it("treats a missing variable as off, the normal state before CI is configured", () => {
    expect(
      releaseCiState(listing([{ name: "OTHER", value: "true" }]), listing([])),
    ).toEqual({
      active: false,
      reason: "",
    });
  });

  it("is on when either the repository or the organization says true", () => {
    const on = [{ name: "NATIVE_RELEASE_ENABLED", value: "true" }];
    expect(releaseCiState(listing(on), listing([])).active).toBe(true);
    expect(releaseCiState(listing([]), listing(on)).active).toBe(true);
    expect(
      releaseCiState(
        listing([{ name: "NATIVE_RELEASE_ENABLED", value: "false" }]),
        listing([]),
      ).active,
    ).toBe(false);
  });

  it("is unknown when gh cannot answer, so the guard refuses", () => {
    const failed = releaseCiState(listing([]), {
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

  it("refuses when git status cannot be read", () => {
    expect(
      guardProblems({
        ...clean,
        tree: { ok: false, reason: "not a repo", changes: [] },
      }).join(" "),
    ).toMatch(/Could not read git status/);
  });

  it("refuses uncommitted changes, a wrong prebuild and a failed build-number check", () => {
    const problems = guardProblems({
      ...clean,
      tree: { ok: true, changes: [" M app.config.ts"] },
      generatedVariant: "production",
      buildNumberCheck: { ok: false, message: "ios says 210\n" },
    });
    expect(problems).toHaveLength(3);
    expect(problems[1]).toContain(
      "cd apps/native && APP_VARIANT=preview CONPAWS_ALLOW_PREVIEW=1 bun run prebuild",
    );
  });
});

describe("uploaded build numbers", () => {
  it("reads every number Xcode recorded, including an Organizer renumber", () => {
    const xml = `<dict><key>Distributions</key><array>
      <dict><key>uploadedBuildNumber</key>
        <string>212</string></dict>
      <dict><key>uploadedBuildNumber</key><string>211</string></dict>
    </array></dict>`;
    expect(uploadedBuildNumbers(xml)).toEqual([212, 211]);
    expect(uploadedBuildNumbers("<dict/>")).toEqual([]);
  });

  it("refuses a number at or below the highest upload", () => {
    expect(uploadNumberProblem({ build: 212, uploaded: 212 })).toMatch(
      /already uploaded/,
    );
    expect(uploadNumberProblem({ build: 211, uploaded: 212 })).toMatch(
      /already uploaded/,
    );
    expect(uploadNumberProblem({ build: 213, uploaded: 212 })).toBeNull();
  });
});

describe("sidecarProblems", () => {
  const sidecar = { sha: "abc1234", variant: "production", build: 213 };

  it("accepts an archive this script made from the current commit", () => {
    expect(
      sidecarProblems({
        sidecar,
        sha: "abc1234",
        variant: "production",
        build: 213,
      }),
    ).toEqual([]);
  });

  it("refuses foreign, stale, wrong-variant and wrong-number archives", () => {
    expect(
      sidecarProblems({
        sidecar: null,
        sha: "abc1234",
        variant: "production",
        build: 213,
      })[0],
    ).toMatch(/only archives made by this script/);
    expect(
      sidecarProblems({
        sidecar,
        sha: "def5678",
        variant: "preview",
        build: 214,
      }),
    ).toHaveLength(3);
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
  const bundle = (id: string, build = "213", version = "1.0.0") => ({
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
        buildNumber: 213,
      }),
    ).toEqual([]);
  });

  it("catches a preview archive on the public path, from either variant source", () => {
    expect(
      archiveProblems({
        bundles: [
          { ...bundles[0], ConPawsBuildVariant: "preview" },
          ...bundles.slice(1),
        ],
        expoVariant: "preview",
        expectedVariant: "production",
        buildNumber: 213,
      }),
    ).toHaveLength(2);
  });

  it("catches a stale or missing Watch or widget target", () => {
    const problems = archiveProblems({
      bundles: [
        bundles[0],
        bundle("com.mrdemonwolf.conpaws.widgets", "212"),
        null,
        bundles[3],
      ],
      expoVariant: "production",
      expectedVariant: "production",
      buildNumber: 213,
    });
    expect(problems.join(" ")).toMatch(/expected 213/);
    expect(problems.join(" ")).toMatch(/missing/);
  });
});

describe("bundleProblems", () => {
  const config = {
    extra: { appVariant: "preview" },
    android: { package: "com.mrdemonwolf.conpaws" },
  };
  const gradle = "    applicationId 'com.mrdemonwolf.conpaws'\n";

  it("accepts the upload key, the package, the native app ID and the variant", () => {
    expect(
      bundleProblems({
        expoConfig: config,
        certificateSha256: UPLOAD_CERT_SHA256,
        expectedVariant: "preview",
        gradle,
      }),
    ).toEqual([]);
  });

  it("rejects a debug-signed, wrong-variant, wrong-package or development-prebuilt bundle", () => {
    expect(
      bundleProblems({
        expoConfig: {
          extra: { appVariant: "production" },
          android: { package: "com.example" },
        },
        certificateSha256: "AA:BB",
        expectedVariant: "preview",
        gradle: "    applicationId 'com.mrdemonwolf.conpaws.dev'\n",
      }),
    ).toHaveLength(4);
  });
});

describe("localDay", () => {
  it("uses the local calendar day, like Xcode's Archives folders", () => {
    expect(localDay(new Date(2026, 10, 17, 23, 30))).toBe("2026-11-17");
    expect(localDay(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });
});
