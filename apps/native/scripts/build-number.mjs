/**
 * Build-number tooling for the local release path.
 *
 * ConPaws ships from local builds -- an Xcode Organizer archive and a Gradle
 * release bundle -- so nothing hands out an increasing store build number the
 * way EAS remote version counters would. `BUILD_NUMBER` in `app.config.ts` is
 * that counter, and both stores reject an upload that reuses or lowers it.
 *
 * Two failure modes have actually happened here, and this script exists for
 * them rather than for tidiness:
 *
 * 1. Shipping without bumping. `--bump` increments the constant, and
 *    `bun run ship:prep` runs it before prebuild so the release path cannot
 *    skip it.
 * 2. Bumping without prebuilding. `ios/` and `android/` are gitignored CNG
 *    output; until `expo prebuild` regenerates them they still carry the
 *    previous number, and the archive ships that stale value no matter what
 *    `app.config.ts` says. `--check` compares the three and fails loudly.
 *
 * Gaps are fine. Apple and Google only require the number to increase, so a
 * discarded candidate that burns a number costs nothing. Deriving the value
 * instead -- `git rev-list --count HEAD` -- is what this replaced: the count
 * reached 208 while the shipped build was 203.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const appDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = path.join(appDirectory, "app.config.ts");
const infoPlistPath = path.join(appDirectory, "ios/ConPaws/Info.plist");
const gradlePath = path.join(appDirectory, "android/app/build.gradle");

/**
 * Anchored on the declaration, not on the digits. Comments in `app.config.ts`
 * cite past builds by number ("build 204 was rejected with..."), and a looser
 * pattern rewrites that history instead of the constant.
 */
const declaration = /^const BUILD_NUMBER = (\d+);$/m;

export function parseBuildNumber(source) {
  const match = source.match(declaration);
  if (!match) {
    throw new Error(
      "No `const BUILD_NUMBER = <digits>;` declaration in app.config.ts",
    );
  }
  return Number(match[1]);
}

export function bumpBuildNumber(source) {
  const current = parseBuildNumber(source);
  const next = current + 1;
  return {
    current,
    next,
    source: source.replace(declaration, `const BUILD_NUMBER = ${next};`),
  };
}

/** CFBundleVersion is the string on the line after its `<key>`. */
export function parseInfoPlistBuildNumber(xml) {
  const match = xml.match(
    /<key>CFBundleVersion<\/key>\s*<string>(\d+)<\/string>/,
  );
  return match ? Number(match[1]) : null;
}

/**
 * Which variant produced the generated iOS project.
 *
 * `app.config.ts` writes `ConPawsBuildVariant` into Info.plist precisely so
 * this is answerable from the artifact. Older prebuild output predates the key
 * and returns null, which is not a failure -- see `describeVariantRisk`.
 */
export function parseInfoPlistVariant(xml) {
  const match = xml.match(
    /<key>ConPawsBuildVariant<\/key>\s*<string>([a-z]+)<\/string>/,
  );
  return match ? match[1] : null;
}

/**
 * Refuses a release archive built from the `preview` variant.
 *
 * preview and production share a bundle identifier and an icon, so the two
 * artifacts are indistinguishable on the Home Screen (RELEASING.md). But
 * `developerToolsEnabled()` turns the debug menu, fixture data and the UI
 * gallery on for preview, and ConPaws ships to a *public* TestFlight -- where
 * that reaches everyone with the link, not just the owner.
 *
 * Both signals are checked because they catch different mistakes: the env var
 * catches `APP_VARIANT=preview bun run ship:prep` before prebuild even runs,
 * the plist catches an archive of native output prebuilt as preview earlier.
 * `CONPAWS_ALLOW_PREVIEW=1` is the deliberate escape hatch for owner QA builds.
 */
export function describeVariantRisk(plistVariant, envVariant, allowPreview) {
  if (allowPreview) return [];
  const problems = [];
  if (envVariant === "preview") {
    problems.push(
      "APP_VARIANT=preview is set: this build would carry the debug menu, " +
        "fixture data and the UI gallery.",
    );
  }
  if (plistVariant === "preview") {
    problems.push(
      "ios/ConPaws/Info.plist ConPawsBuildVariant is `preview`: the generated " +
        "native project was prebuilt from the preview variant.",
    );
  }
  return problems;
}

export function parseGradleVersionCode(text) {
  const match = text.match(/^\s*versionCode\s+(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

/**
 * Absent native output is not a failure. A fresh clone has no `ios/` or
 * `android/` directory, and reporting that as a stale build number would train
 * everyone to ignore this check.
 */
export function describeDrift(expected, generated) {
  return generated
    .filter((item) => item.value !== null && item.value !== expected)
    .map(
      (item) =>
        `${item.label} is ${item.value}, app.config.ts says ${expected}`,
    );
}

async function readIfPresent(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function bump() {
  const source = await readFile(configPath, "utf8");
  const result = bumpBuildNumber(source);
  await writeFile(configPath, result.source);
  console.log(`Build number ${result.current} -> ${result.next}`);
  console.log(
    "Run `expo prebuild` before archiving, then commit app.config.ts with the release.",
  );
}

async function check() {
  const expected = parseBuildNumber(await readFile(configPath, "utf8"));
  const [plist, gradle] = await Promise.all([
    readIfPresent(infoPlistPath),
    readIfPresent(gradlePath),
  ]);
  const variantProblems = describeVariantRisk(
    plist === null ? null : parseInfoPlistVariant(plist),
    process.env.APP_VARIANT,
    process.env.CONPAWS_ALLOW_PREVIEW === "1",
  );

  if (variantProblems.length > 0) {
    console.error("Refusing a preview build on the release path.\n");
    for (const line of variantProblems) console.error(`  ${line}`);
    console.error(
      "\n  Rebuild with APP_VARIANT unset (production is the default), or set\n" +
        "  CONPAWS_ALLOW_PREVIEW=1 if this really is an owner-only QA build.",
    );
    process.exitCode = 1;
    return;
  }

  const drift = describeDrift(expected, [
    {
      label: "ios/ConPaws/Info.plist CFBundleVersion",
      value: plist === null ? null : parseInfoPlistBuildNumber(plist),
    },
    {
      label: "android/app/build.gradle versionCode",
      value: gradle === null ? null : parseGradleVersionCode(gradle),
    },
  ]);

  if (drift.length > 0) {
    console.error("Native projects are stale. Run `expo prebuild` first.\n");
    for (const line of drift) console.error(`  ${line}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Build number ${expected}, native projects agree.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--bump")) await bump();
  else if (process.argv.includes("--check")) await check();
  else {
    console.error("Usage: node scripts/build-number.mjs --bump | --check");
    process.exitCode = 1;
  }
}
