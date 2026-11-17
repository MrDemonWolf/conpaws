#!/usr/bin/env node
/**
 * Local store builds while the Native release workflow is off.
 *
 *   bun ship:testflight          iOS preview -> TestFlight, internal testers only
 *   bun ship:testflight:public   iOS production -> App Store Connect: internal AND
 *                                external/public TestFlight groups (after Beta App
 *                                Review), and later App Store review
 *   bun ship:android             Android preview bundle for Play internal testing
 *   bun ship:android:public      Android production bundle (open testing / production)
 *
 * iOS uploads with Apple's own `xcodebuild -exportArchive` (destination
 * upload) through the account signed in to Xcode; the team's cloud-managed
 * distribution certificate signs it, so no key or .p12 lives on this Mac.
 * Android stops at a checked, upload-signed bundle: the first Google Play
 * release must be uploaded by hand, and scripted Play uploads belong to the
 * release workflow, which holds the service account. Add --dry-run to iOS to
 * sign without uploading, and --yes to skip the confirmation.
 *
 * Guards, from apps/native/AGENTS.md: a committed tree; native projects that
 * agree with BUILD_NUMBER; the expected variant in the prebuild and in the
 * built artifact (preview builds never leave the internal group); an iOS
 * build number above any this Mac already uploaded; and once
 * NATIVE_RELEASE_ENABLED is on, refusal, because CI then owns uploads and
 * build numbers. Run it from apps/native or through the root aliases.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEAM = "HBB7T99U79";
const PACKAGE = "com.mrdemonwolf.conpaws";
const ARCHIVES = path.join(os.homedir(), "Library/Developer/Xcode/Archives");
const APPLE_BUNDLES = [
  "",
  "PlugIns/ExpoWidgetsTarget.appex",
  "Watch/ConPawsWatch.app",
  "Watch/ConPawsWatch.app/PlugIns/ConPawsWatchWidgetExtension.appex",
];
/**
 * The ConPaws upload key (~/.keystores/conpaws-upload.jks). Google Play binds
 * it to the app at the first upload, so a bundle signed with anything else is
 * a mistake. A fingerprint is public; the key itself never leaves the Mac.
 */
export const UPLOAD_CERT_SHA256 =
  "16:B1:61:7A:50:8B:9A:BA:36:DB:67:A1:CC:4A:83:E8:57:94:19:13:B2:D7:05:84:18:93:18:EC:12:63:77:17";

export const TRACKS = {
  ios: {
    testflight: {
      variant: "preview",
      internalOnly: true,
      label: "TestFlight, internal testers only",
    },
    public: {
      variant: "production",
      internalOnly: false,
      label:
        "App Store Connect: internal and external TestFlight groups, and App Store review",
    },
  },
  android: {
    internal: {
      variant: "preview",
      label: "Google Play internal testing",
      console:
        "Play Console > Test and release > Testing > Internal testing > Create new release",
    },
    public: {
      variant: "production",
      label: "Google Play open testing or production",
      console:
        "Play Console > Test and release > Testing > Open testing (or Production) > Create new release",
    },
  },
};

/** `ios|android [--track t] [--dry-run] [--yes] [--archive path]` */
export function parseArgs(argv) {
  const [platform, ...rest] = argv;
  if (!TRACKS[platform])
    throw new Error("First argument must be ios or android.");
  const options = {
    platform,
    track: undefined,
    dryRun: false,
    yes: false,
    archive: undefined,
  };
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--track") options.track = rest[++index];
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--archive") options.archive = rest[++index];
    else throw new Error(`Unknown option ${arg}.`);
  }
  options.track ??= platform === "ios" ? "testflight" : "internal";
  const trackConfig = TRACKS[platform][options.track];
  if (!trackConfig)
    throw new Error(
      `Unknown ${platform} track "${options.track}". Use ${Object.keys(TRACKS[platform]).join(" or ")}.`,
    );
  if (options.archive && platform !== "ios")
    throw new Error("--archive only applies to ios.");
  if (options.dryRun && platform !== "ios")
    throw new Error(
      "Android never uploads from here, so --dry-run does not apply.",
    );
  return { ...options, trackConfig };
}

/**
 * Release CI state from `gh variable list --json name,value`. A missing
 * variable is the normal "off" state; anything gh cannot answer counts as
 * unknown, and unknown refuses, because a wrong guess costs a build number.
 */
export function releaseCiState({ ok, stdout, stderr }) {
  if (!ok) return { active: null, reason: (stderr || "gh failed").trim() };
  try {
    const variable = JSON.parse(stdout).find(
      (item) => item.name === "NATIVE_RELEASE_ENABLED",
    );
    return { active: variable?.value === "true", reason: "" };
  } catch {
    return { active: null, reason: "gh returned something that is not JSON" };
  }
}

/** Every reason not to build or upload, worded as what to do about it. */
export function guardProblems({
  dirty,
  releaseCi,
  expectedVariant,
  generatedVariant,
  buildNumberCheck,
}) {
  const problems = [];
  if (releaseCi.active === null)
    problems.push(
      `Could not confirm that release CI is off (${releaseCi.reason}). Run \`gh auth status\` and try again.`,
    );
  else if (releaseCi.active)
    problems.push(
      "Release CI is on (NATIVE_RELEASE_ENABLED=true). Store builds now go through Actions > Native release, which owns the build numbers.",
    );
  if (dirty)
    problems.push(
      "The working tree has changes. Commit them first, so the build matches a commit.",
    );
  if (generatedVariant !== expectedVariant)
    problems.push(
      `The native projects were prebuilt as "${generatedVariant ?? "unknown"}", not "${expectedVariant}". Run: cd apps/native && APP_VARIANT=${expectedVariant}${expectedVariant === "preview" ? " CONPAWS_ALLOW_PREVIEW=1" : ""} bun run prebuild`,
    );
  if (!buildNumberCheck.ok)
    problems.push(
      `build-number:check failed: ${buildNumberCheck.message.trim()} To bump: cd apps/native && bun run build-number:bump, commit, then prebuild.`,
    );
  return problems;
}

/** The highest `uploadedBuildNumber` in an archive Info.plist rendered as XML. */
export function uploadedBuildNumbers(xml) {
  return [
    ...xml.matchAll(
      /<key>uploadedBuildNumber<\/key>\s*<string>(\d+)<\/string>/g,
    ),
  ].map(([, value]) => Number(value));
}

export function buildExportOptions({ track, dryRun }) {
  const entries = {
    method: "app-store-connect",
    destination: dryRun ? "export" : "upload",
    signingStyle: "automatic",
    teamID: TEAM,
    uploadSymbols: true,
    manageAppVersionAndBuildNumber: false,
    testFlightInternalTestingOnly: track.internalOnly,
  };
  const body = Object.entries(entries)
    .map(([key, value]) =>
      typeof value === "boolean"
        ? `  <key>${key}</key><${value}/>`
        : `  <key>${key}</key><string>${value}</string>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${body}
</dict>
</plist>
`;
}

/** Checks an archive's four Info.plists and its bundled Expo config. */
export function archiveProblems({
  bundles,
  expoVariant,
  expectedVariant,
  buildNumber,
}) {
  const problems = [];
  const app = bundles[0];
  if (app?.ConPawsBuildVariant !== expectedVariant)
    problems.push(
      `ConPawsBuildVariant is "${app?.ConPawsBuildVariant}", expected "${expectedVariant}".`,
    );
  if (expoVariant !== expectedVariant)
    problems.push(
      `The bundled Expo config says appVariant "${expoVariant}", expected "${expectedVariant}".`,
    );
  for (const bundle of bundles) {
    if (!bundle) {
      problems.push("A widget or Watch target is missing from the archive.");
      continue;
    }
    if (String(bundle.CFBundleVersion) !== String(buildNumber))
      problems.push(
        `${bundle.CFBundleIdentifier} has build ${bundle.CFBundleVersion}, expected ${buildNumber}.`,
      );
    if (bundle.CFBundleShortVersionString !== app?.CFBundleShortVersionString)
      problems.push(
        `${bundle.CFBundleIdentifier} has version ${bundle.CFBundleShortVersionString}, the app has ${app?.CFBundleShortVersionString}.`,
      );
  }
  return problems;
}

/** Checks an Android bundle's bundled Expo config and signing certificate. */
export function bundleProblems({
  expoConfig,
  certificateSha256,
  expectedVariant,
}) {
  const problems = [];
  if (expoConfig?.extra?.appVariant !== expectedVariant)
    problems.push(
      `The bundled Expo config says appVariant "${expoConfig?.extra?.appVariant}", expected "${expectedVariant}".`,
    );
  if (expoConfig?.android?.package !== PACKAGE)
    problems.push(
      `The bundle's package is "${expoConfig?.android?.package}", expected "${PACKAGE}".`,
    );
  if (certificateSha256 !== UPLOAD_CERT_SHA256)
    problems.push(
      "The bundle is not signed with the ConPaws upload key. Prebuild must pick up ~/.keystores/conpaws-signing.properties.",
    );
  return problems;
}

// ---- Effects --------------------------------------------------------------

function run(command, args, { env, cwd = APP, quiet = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: quiet ? "pipe" : "inherit",
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function readPlist(file) {
  const result = run("plutil", ["-convert", "json", "-o", "-", file], {
    quiet: true,
  });
  return result.ok ? JSON.parse(result.stdout) : null;
}

function buildEnv(variant) {
  return {
    APP_VARIANT: variant,
    // Same values as release-native.yml; build-number.mjs only accepts "1".
    CONPAWS_ALLOW_PREVIEW: variant === "preview" ? "1" : "0",
    // Symbols reach Apple with the upload; Sentry needs its own token.
    SENTRY_DISABLE_AUTO_UPLOAD: process.env.SENTRY_AUTH_TOKEN
      ? "false"
      : "true",
  };
}

function buildNumber() {
  const match = readFileSync(path.join(APP, "app.config.ts"), "utf8").match(
    /const BUILD_NUMBER = (\d+);/,
  );
  if (!match) throw new Error("BUILD_NUMBER not found in app.config.ts.");
  return Number(match[1]);
}

function highestUploadedIosBuild() {
  if (!existsSync(ARCHIVES)) return 0;
  let highest = 0;
  for (const day of readdirSync(ARCHIVES)) {
    const folder = path.join(ARCHIVES, day);
    let entries = [];
    try {
      entries = readdirSync(folder);
    } catch {
      continue;
    }
    for (const name of entries.filter((entry) =>
      /^ConPaws.*\.xcarchive$/.test(entry),
    )) {
      const xml = run(
        "plutil",
        ["-convert", "xml1", "-o", "-", path.join(folder, name, "Info.plist")],
        { quiet: true },
      );
      if (xml.ok)
        highest = Math.max(highest, ...uploadedBuildNumbers(xml.stdout));
    }
  }
  return highest;
}

function preflight(options) {
  const variant = options.trackConfig.variant;
  const problems = guardProblems({
    dirty:
      run("git", ["status", "--porcelain"], { quiet: true }).stdout.trim() !==
      "",
    releaseCi: releaseCiState(
      run("gh", ["variable", "list", "--json", "name,value"], { quiet: true }),
    ),
    expectedVariant: variant,
    generatedVariant:
      options.platform === "ios"
        ? readPlist(path.join(APP, "ios/ConPaws/Info.plist"))
            ?.ConPawsBuildVariant
        : variant, // Android checks the variant inside the built bundle instead.
    buildNumberCheck: (() => {
      const check = run("node", ["scripts/build-number.mjs", "--check"], {
        quiet: true,
        env: buildEnv(variant),
      });
      return { ok: check.ok, message: check.stderr || check.stdout };
    })(),
  });
  if (options.platform === "ios" && !options.dryRun) {
    const uploaded = highestUploadedIosBuild();
    if (buildNumber() <= uploaded)
      problems.push(
        `Build ${uploaded} was already uploaded from this Mac, so ${buildNumber()} would be rejected. Bump: cd apps/native && bun run build-number:bump, commit, then prebuild.`,
      );
  }
  return problems;
}

async function confirm(question, yes) {
  if (yes) return true;
  if (!process.stdin.isTTY) {
    console.error(
      "Not a terminal. Re-run with --yes to upload without asking.",
    );
    return false;
  }
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(`${question} [y/N] `);
  prompt.close();
  return /^y(es)?$/i.test(answer.trim());
}

function fail(lines) {
  for (const line of [].concat(lines)) console.error(`✗ ${line}`);
  process.exit(1);
}

async function shipIos(options) {
  const { trackConfig: track } = options;
  const build = buildNumber();
  const sha = run("git", ["rev-parse", "--short", "HEAD"], {
    quiet: true,
  }).stdout.trim();
  let archive = options.archive;
  if (!archive) {
    const day = new Date().toISOString().slice(0, 10);
    const stamp = new Date().toTimeString().slice(0, 5).replace(":", "");
    archive = path.join(
      ARCHIVES,
      day,
      `ConPaws ${build} ${track.variant} ${sha} ${stamp}.xcarchive`,
    );
    mkdirSync(path.dirname(archive), { recursive: true });
    console.log(`Archiving build ${build} (${track.variant}, ${sha})…`);
    const archived = run(
      "xcodebuild",
      [
        "-workspace",
        "ios/ConPaws.xcworkspace",
        "-scheme",
        "ConPaws",
        "-configuration",
        "Release",
        "-destination",
        "generic/platform=iOS",
        "-archivePath",
        archive,
        "-allowProvisioningUpdates",
        "-quiet",
        "archive",
      ],
      { env: buildEnv(track.variant) },
    );
    if (!archived.ok) fail("The archive failed; see the Xcode output above.");
  }
  const appPath = path.join(archive, "Products/Applications/ConPaws.app");
  const bundles = APPLE_BUNDLES.map((relative) =>
    readPlist(path.join(appPath, relative, "Info.plist")),
  );
  let expoVariant;
  try {
    expoVariant = JSON.parse(
      readFileSync(path.join(appPath, "EXConstants.bundle/app.config"), "utf8"),
    ).extra?.appVariant;
  } catch {}
  const problems = archiveProblems({
    bundles,
    expoVariant,
    expectedVariant: track.variant,
    buildNumber: build,
  });
  if (problems.length) fail(problems);
  const version = bundles[0].CFBundleShortVersionString;
  console.log(
    `✓ Archive checked: ConPaws ${version} (${build}), ${track.variant}, 4 targets.`,
  );

  if (
    !options.dryRun &&
    !(await confirm(
      `Upload ConPaws ${version} (${build}) ${track.variant} to ${track.label}?`,
      options.yes,
    ))
  )
    fail("Not uploaded.");
  const work = path.join(os.tmpdir(), `conpaws-export-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const exportOptions = path.join(work, "ExportOptions.plist");
  writeFileSync(
    exportOptions,
    buildExportOptions({ track, dryRun: options.dryRun }),
  );
  const exported = run("xcodebuild", [
    "-exportArchive",
    "-archivePath",
    archive,
    "-exportPath",
    path.join(work, "out"),
    "-exportOptionsPlist",
    exportOptions,
    "-allowProvisioningUpdates",
  ]);
  if (!exported.ok)
    fail(
      'Export failed. "PLA Update available" means the Account Holder must accept the latest agreement at developer.apple.com/account, then refresh Xcode > Settings > Accounts.',
    );
  console.log(
    options.dryRun
      ? `✓ Dry run: signed for App Store Connect, not uploaded (${path.join(work, "out")}).`
      : `✓ Uploaded to ${track.label}. Apple processes it in about 10-30 minutes.`,
  );
  console.log(`Archive (keep it; its dSYMs symbolicate crashes): ${archive}`);
  console.log(
    `To upload this archive later: node scripts/ship-store.mjs ios --track ${options.track} --archive "${archive}"`,
  );
}

function shipAndroid(options) {
  const { trackConfig: track } = options;
  const build = buildNumber();
  const sha = run("git", ["rev-parse", "--short", "HEAD"], {
    quiet: true,
  }).stdout.trim();
  console.log(
    `Building the Android bundle ${build} (${track.variant}, ${sha})…`,
  );
  const built = run(
    "./gradlew",
    [":app:bundleRelease", "--console=plain", "-q"],
    {
      cwd: path.join(APP, "android"),
      env: buildEnv(track.variant),
    },
  );
  if (!built.ok) fail("The bundle build failed; see the Gradle output above.");
  const aab = path.join(
    APP,
    "android/app/build/outputs/bundle/release/app-release.aab",
  );
  let expoConfig;
  try {
    expoConfig = JSON.parse(
      run("unzip", ["-p", aab, "base/assets/app.config"], { quiet: true })
        .stdout,
    );
  } catch {}
  const printed = run("keytool", ["-printcert", "-jarfile", aab], {
    quiet: true,
  }).stdout;
  const certificateSha256 = printed.match(/SHA256:\s*([0-9A-F:]+)/)?.[1];
  const problems = bundleProblems({
    expoConfig,
    certificateSha256,
    expectedVariant: track.variant,
  });
  if (problems.length) fail(problems);
  const version = expoConfig.version;
  const out = path.join(APP, "build/store");
  mkdirSync(out, { recursive: true });
  const named = path.join(
    out,
    `ConPaws-${version}-${build}-${track.variant}.aab`,
  );
  copyFileSync(aab, named);
  console.log(
    `✓ Bundle checked: ${PACKAGE} ${version} (${build}), ${track.variant}, upload key.`,
  );
  console.log(`Upload it by hand to ${track.label}: ${track.console}`);
  console.log(`File: ${named}`);
  console.log(
    "Google rejects a versionCode at or below the last one it accepted, on any track.",
  );
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail([
      error.message,
      "Usage: node scripts/ship-store.mjs ios|android [--track …] [--dry-run] [--yes] [--archive path]",
    ]);
  }
  const problems = preflight(options);
  if (problems.length) fail(problems);
  if (options.platform === "ios") await shipIos(options);
  else shipAndroid(options);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => fail(error.message));
}
