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
 * upload); the team's cloud-managed distribution certificate signs it, so no
 * .p12 lives on this Mac. With an App Store Connect API key (see
 * app-store-connect.mjs) xcodebuild authenticates with the key instead of the
 * account signed in to Xcode, and --beta sends the processed build on:
 *
 *   --beta private   internal TestFlight groups (Private Beta)
 *   --beta public    external groups (External Beta) + Beta App Review
 *   --beta both      both of the above
 *   --notes "…" / --notes-file path   What to Test (required for public)
 *   --distribute-only --archive path  skip the upload, only distribute
 *
 * Android stops at a checked, upload-signed bundle; scripted Play uploads
 * belong to the release workflow, which holds the service account. Add
 * --dry-run to iOS to sign without uploading, --yes to skip the confirmation,
 * and --archive to upload an archive this script made earlier from the same
 * commit.
 *
 * Guards, from apps/native/AGENTS.md: a committed tree, re-checked right
 * before the upload; native projects that agree with BUILD_NUMBER; the
 * expected variant in the prebuild and in the built artifact (preview builds
 * never leave the internal group); an iOS build number above any already
 * uploaded from this Mac, dry runs included; and once NATIVE_RELEASE_ENABLED
 * is on (repo or organization), refusal, because CI then owns uploads and
 * build numbers. Anything that cannot be checked refuses.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  ascCredentials,
  BETA_AUDIENCES,
  betaProblems,
  createAscClient,
  distributeTestFlightBuild,
  highestAscBuild,
  xcodeAuthArgs,
} from "./app-store-connect.mjs";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_SLUG = "MrDemonWolf/conpaws";
const TEAM = "HBB7T99U79";
const PACKAGE = "com.mrdemonwolf.conpaws";
const ARCHIVES = path.join(os.homedir(), "Library/Developer/Xcode/Archives");
const SIDECAR = "ConPawsShip.json";
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
      alias: "ship:testflight",
      label: "TestFlight, internal testers only",
    },
    public: {
      variant: "production",
      internalOnly: false,
      alias: "ship:testflight:public",
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

/** `ios|android [--track t] [--dry-run] [--yes] [--archive path] [--beta b] [--notes t | --notes-file f] [--distribute-only]` */
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
    beta: undefined,
    notes: undefined,
    notesFile: undefined,
    distributeOnly: false,
  };
  const value = (index, flag) => {
    const next = rest[index];
    if (next === undefined || next.startsWith("--"))
      throw new Error(`${flag} needs a value.`);
    return next;
  };
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--track") options.track = value(++index, arg);
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--archive")
      options.archive = path.resolve(value(++index, arg));
    else if (arg === "--beta") options.beta = value(++index, arg);
    else if (arg === "--notes") options.notes = value(++index, arg);
    else if (arg === "--notes-file")
      options.notesFile = path.resolve(value(++index, arg));
    else if (arg === "--distribute-only") options.distributeOnly = true;
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
  if (
    platform !== "ios" &&
    (options.beta ||
      options.notes ||
      options.notesFile ||
      options.distributeOnly)
  )
    throw new Error("--beta, --notes and --distribute-only only apply to ios.");
  if (options.beta && !BETA_AUDIENCES[options.beta])
    throw new Error(
      `Unknown --beta "${options.beta}". Use private, public or both.`,
    );
  if (options.notes !== undefined && options.notesFile)
    throw new Error("Use --notes or --notes-file, not both.");
  if (options.distributeOnly && (!options.archive || !options.beta))
    throw new Error(
      "--distribute-only needs --archive (the uploaded archive) and --beta.",
    );
  if (options.distributeOnly && options.dryRun)
    throw new Error("--distribute-only and --dry-run cannot be combined.");
  if (options.beta && options.dryRun)
    throw new Error("A dry run uploads nothing, so --beta does not apply.");
  return { ...options, trackConfig };
}

const GENERATED =
  /^apps\/native\/targets\/(watch|watch-widget)\/Assets\.xcassets\//;

/**
 * Uncommitted paths that matter, from `git status --porcelain=v1 -z`.
 * Prebuild regenerates the Watch targets' asset catalogs (icon and accent
 * colours) from the build variant, so they differ from the committed copies
 * after every preview or production prebuild; those are derived output. A
 * rename or copy counts unless both of its paths are in those catalogs.
 */
export function meaningfulChanges(porcelainZ) {
  const tokens = porcelainZ.split("\0");
  const changes = [];
  for (let index = 0; index < tokens.length; index++) {
    const entry = tokens[index];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    const paths = [entry.slice(3)];
    if (/[RC]/.test(status)) paths.push(tokens[++index] ?? "");
    if (!paths.every((file) => GENERATED.test(file))) changes.push(entry);
  }
  return changes;
}

/**
 * Release CI state from the repository and organization variable listings
 * (`vars.NATIVE_RELEASE_ENABLED` in the workflow resolves both). A missing
 * variable is the normal "off" state; anything that cannot be read counts as
 * unknown, and unknown refuses, because a wrong guess costs a build number.
 */
export function releaseCiState(...listings) {
  let active = false;
  for (const { ok, stdout, stderr } of listings) {
    if (!ok) return { active: null, reason: (stderr || "gh failed").trim() };
    try {
      const variable = JSON.parse(stdout).find(
        (item) => item.name === "NATIVE_RELEASE_ENABLED",
      );
      if (variable?.value === "true") active = true;
    } catch {
      return { active: null, reason: "gh returned something that is not JSON" };
    }
  }
  return { active, reason: "" };
}

/** Every reason not to build or upload, worded as what to do about it. */
export function guardProblems({
  tree,
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
  if (!tree.ok) problems.push(`Could not read git status (${tree.reason}).`);
  else if (tree.changes.length)
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

/** Refuses an iOS build number App Store Connect already holds from this Mac. */
export function uploadNumberProblem({ build, uploaded }) {
  return build <= uploaded
    ? `Build ${uploaded} was already uploaded from this Mac, so ${build} would be rejected. Bump: cd apps/native && bun run build-number:bump, commit, then prebuild.`
    : null;
}

/** Every `uploadedBuildNumber` in an archive Info.plist rendered as XML. */
export function uploadedBuildNumbers(xml) {
  return [
    ...xml.matchAll(
      /<key>uploadedBuildNumber<\/key>\s*<string>(\d+)<\/string>/g,
    ),
  ].map(([, value]) => Number(value));
}

/** Ties a reused archive to this script, the current commit and the track. */
export function sidecarProblems({ sidecar, sha, variant, build }) {
  if (!sidecar)
    return [
      `The archive has no ${SIDECAR}: only archives made by this script can be reused with --archive.`,
    ];
  const problems = [];
  if (sidecar.sha !== sha)
    problems.push(
      `The archive was made from ${sidecar.sha}, not the current commit ${sha}.`,
    );
  if (sidecar.variant !== variant)
    problems.push(`The archive is a ${sidecar.variant} build, not ${variant}.`);
  if (Number(sidecar.build) !== Number(build))
    problems.push(`The archive is build ${sidecar.build}, not ${build}.`);
  return problems;
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

/** Checks an Android bundle's Expo config, signing key and native app ID. */
export function bundleProblems({
  expoConfig,
  certificateSha256,
  expectedVariant,
  gradle,
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
  if (
    !new RegExp(`applicationId ['"]${PACKAGE.replaceAll(".", "\\.")}['"]`).test(
      gradle ?? "",
    )
  )
    problems.push(
      `android/app/build.gradle does not build ${PACKAGE} (a development prebuild?). Run: cd apps/native && APP_VARIANT=${expectedVariant} bun run prebuild`,
    );
  if (certificateSha256 !== UPLOAD_CERT_SHA256)
    problems.push(
      "The bundle is not signed with the ConPaws upload key. Prebuild must pick up ~/.keystores/conpaws-signing.properties.",
    );
  return problems;
}

/** Local calendar day, matching how Xcode names its Archives folders. */
export function localDay(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function headSha() {
  return run("git", ["rev-parse", "--short", "HEAD"], {
    quiet: true,
  }).stdout.trim();
}

function treeState() {
  const status = run("git", ["status", "--porcelain=v1", "-z"], {
    quiet: true,
  });
  return status.ok
    ? { ok: true, changes: meaningfulChanges(status.stdout) }
    : {
        ok: false,
        reason: status.stderr.trim() || "git status failed",
        changes: [],
      };
}

function highestUploadedIosBuild() {
  if (!existsSync(ARCHIVES)) return 0;
  let highest = 0;
  for (const day of readdirSync(ARCHIVES)) {
    let entries = [];
    try {
      entries = readdirSync(path.join(ARCHIVES, day));
    } catch {
      continue;
    }
    for (const name of entries.filter((entry) =>
      /^ConPaws.*\.xcarchive$/.test(entry),
    )) {
      const xml = run(
        "plutil",
        [
          "-convert",
          "xml1",
          "-o",
          "-",
          path.join(ARCHIVES, day, name, "Info.plist"),
        ],
        {
          quiet: true,
        },
      );
      if (xml.ok)
        highest = Math.max(highest, ...uploadedBuildNumbers(xml.stdout));
    }
  }
  return highest;
}

async function preflight(options) {
  const variant = options.trackConfig.variant;
  const check = run("node", ["scripts/build-number.mjs", "--check"], {
    quiet: true,
    env: buildEnv(variant),
  });
  const problems = guardProblems({
    tree: treeState(),
    releaseCi: releaseCiState(
      run(
        "gh",
        ["variable", "list", "--repo", REPO_SLUG, "--json", "name,value"],
        { quiet: true },
      ),
      run(
        "gh",
        [
          "api",
          `repos/${REPO_SLUG}/actions/organization-variables`,
          "--jq",
          ".variables",
        ],
        {
          quiet: true,
        },
      ),
    ),
    expectedVariant: variant,
    generatedVariant:
      options.platform === "ios"
        ? readPlist(path.join(APP, "ios/ConPaws/Info.plist"))
            ?.ConPawsBuildVariant
        : variant, // Android checks build.gradle and the built bundle instead.
    buildNumberCheck: { ok: check.ok, message: check.stderr || check.stdout },
  });
  if (options.platform === "ios") {
    try {
      options.credentials = ascCredentials({
        env: process.env,
        home: os.homedir(),
      });
    } catch (error) {
      problems.push(error.message);
    }
    if (options.beta && !options.credentials && !problems.length)
      problems.push(
        "--beta needs an App Store Connect API key: ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 plus ~/.appstoreconnect/conpaws.json with keyId and issuerId.",
      );
    if (options.notesFile) {
      try {
        options.notes = readFileSync(options.notesFile, "utf8").trim();
      } catch {
        problems.push(`Cannot read --notes-file ${options.notesFile}.`);
      }
    }
    problems.push(
      ...betaProblems({
        beta: options.beta,
        track: options.trackConfig,
        notes: options.notes,
      }),
    );
    if (!options.distributeOnly) {
      // Dry runs too: a dry run should prove the number is still usable.
      // App Store Connect knows uploads from every Mac and the Organizer.
      let uploaded = highestUploadedIosBuild();
      if (options.credentials) {
        try {
          uploaded = Math.max(
            uploaded,
            await highestAscBuild({
              client: createAscClient({ credentials: options.credentials }),
              bundleId: PACKAGE,
            }),
          );
        } catch (error) {
          problems.push(
            `Could not read uploaded builds from App Store Connect: ${error.message}`,
          );
        }
      }
      const numberProblem = uploadNumberProblem({
        build: buildNumber(),
        uploaded,
      });
      if (numberProblem) problems.push(numberProblem);
    }
    if (!options.dryRun && !options.yes && !process.stdin.isTTY)
      problems.push(
        "Not a terminal, so the upload cannot be confirmed. Re-run in a terminal, or add --yes.",
      );
  }
  return problems;
}

async function confirm(question, yes) {
  if (yes) return true;
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
  const sha = headSha();
  let archive = options.archive;
  if (archive) {
    let sidecar = null;
    try {
      sidecar = JSON.parse(readFileSync(path.join(archive, SIDECAR), "utf8"));
    } catch {}
    const problems = sidecarProblems({
      sidecar,
      sha,
      variant: track.variant,
      build,
    });
    if (problems.length) fail(problems);
  } else {
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    archive = path.join(
      ARCHIVES,
      localDay(now),
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
        ...xcodeAuthArgs(options.credentials),
        "-quiet",
        "archive",
      ],
      { env: buildEnv(track.variant) },
    );
    if (!archived.ok) fail("The archive failed; see the Xcode output above.");
    writeFileSync(
      path.join(archive, SIDECAR),
      `${JSON.stringify({ sha, variant: track.variant, build }, null, 2)}\n`,
    );
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

  const audiences = options.beta
    ? [
        BETA_AUDIENCES[options.beta].internal &&
          "internal testers (Private Beta)",
        BETA_AUDIENCES[options.beta].external &&
          "external testers (External Beta, after Beta App Review)",
      ]
        .filter(Boolean)
        .join(" and ")
    : "";
  // Keep the notes with the archive so a retry can reuse them.
  const notesFile = options.notes
    ? path.join(archive, "WhatToTest.txt")
    : undefined;
  if (notesFile) writeFileSync(notesFile, `${options.notes}\n`);
  const distribute = async (notBefore) => {
    await distributeTestFlightBuild({
      client: createAscClient({ credentials: options.credentials }),
      bundleId: PACKAGE,
      version,
      build,
      beta: options.beta,
      notes: options.notes,
      notBefore,
    });
  };
  if (options.distributeOnly) {
    if (
      !(await confirm(
        `Send the uploaded ConPaws ${version} (${build}) ${track.variant} to ${audiences}?`,
        options.yes,
      ))
    )
      fail("Nothing sent.");
    // The upload came after the archive; an older build with this number is not it.
    await distribute(statSync(path.join(archive, SIDECAR)).mtimeMs);
    return;
  }

  if (!options.dryRun) {
    // The archive takes minutes; make sure nothing moved under it.
    const tree = treeState();
    if (!tree.ok || tree.changes.length || headSha() !== sha)
      fail(
        "The working tree or commit changed while archiving. Commit, then run again.",
      );
    if (
      !(await confirm(
        `Upload ConPaws ${version} (${build}) ${track.variant} to ${track.label}${audiences ? `, then send it to ${audiences}` : ""}?`,
        options.yes,
      ))
    )
      fail("Not uploaded.");
  }
  const uploadStarted = Date.now();
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
    ...xcodeAuthArgs(options.credentials),
  ]);
  if (!exported.ok)
    fail(
      options.credentials
        ? 'Export failed with the App Store Connect API key. Check the key still exists (Users and Access > Integrations) and has the Admin role; "PLA Update available" means the Account Holder must accept the latest agreement at developer.apple.com/account.'
        : 'Export failed. "PLA Update available" means the Account Holder must accept the latest agreement at developer.apple.com/account. "Credentials Error" means Xcode > Settings > Accounts needs a fresh sign-in, or add an App Store Connect API key (see scripts/app-store-connect.mjs).',
    );
  console.log(
    options.dryRun
      ? `✓ Dry run: signed for App Store Connect, not uploaded (${path.join(work, "out")}).`
      : `✓ Uploaded to ${track.label}. Apple processes it in about 10-30 minutes.`,
  );
  console.log(`Archive (keep it; its dSYMs symbolicate crashes): ${archive}`);
  if (options.dryRun)
    console.log(
      `To upload this archive: bun ${track.alias} --archive "${archive}"`,
    );
  if (!options.dryRun && options.beta) {
    try {
      await distribute(uploadStarted);
    } catch (error) {
      fail([
        `Uploaded, but distribution failed: ${error.message}`,
        `Retry without uploading again: bun ${track.alias} --distribute-only --archive "${archive}" --beta ${options.beta}${notesFile ? ` --notes-file "${notesFile}"` : ""}`,
      ]);
    }
  }
}

function shipAndroid(options) {
  const { trackConfig: track } = options;
  const build = buildNumber();
  console.log(
    `Building the Android bundle ${build} (${track.variant}, ${headSha()})…`,
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
  const problems = bundleProblems({
    expoConfig,
    certificateSha256: printed.match(/SHA256:\s*([0-9A-F:]+)/)?.[1],
    expectedVariant: track.variant,
    gradle: readFileSync(path.join(APP, "android/app/build.gradle"), "utf8"),
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
    "Google Play accepts each versionCode once across all tracks, so a preview and a production bundle need different build numbers.",
  );
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail([
      error.message,
      "Usage: node scripts/ship-store.mjs ios|android [--track …] [--dry-run] [--yes] [--archive path] [--beta private|public|both] [--notes text | --notes-file path] [--distribute-only]",
    ]);
  }
  const problems = await preflight(options);
  if (problems.length) fail(problems);
  if (options.platform === "ios") await shipIos(options);
  else shipAndroid(options);
}

const invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invoked === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => fail(error.message));
}
