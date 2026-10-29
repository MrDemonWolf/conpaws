#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [variant, platform, deviceId] = process.argv.slice(2);
const APP_IDS = {
  development: "com.mrdemonwolf.conpaws.dev",
  preview: "com.mrdemonwolf.conpaws",
};
const APP_ID = Object.hasOwn(APP_IDS, variant) ? APP_IDS[variant] : undefined;
// Fresh iOS simulators can take time to answer while their services initialize.
// Keep device identity checks bounded without relaxing any target restrictions.
const PREFLIGHT_TIMEOUT_MS = 30_000;

function fail(message) {
  console.error(`Native E2E preflight: ${message}`);
  process.exit(1);
}

function read(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: PREFLIGHT_TIMEOUT_MS,
    });
  } catch (error) {
    const detail =
      error?.code === "ETIMEDOUT"
        ? `timed out after ${PREFLIGHT_TIMEOUT_MS / 1000}s`
        : "failed";
    fail(`${command} ${args.join(" ")} ${detail}`);
  }
}

if (!APP_ID || !deviceId || !["ios", "android"].includes(platform)) {
  fail(
    "usage: bun run --filter @conpaws/native e2e -- <development|preview> <ios|android> <booted-local-device-id>",
  );
}

if (platform === "android") {
  // ADB's emulator serial prefix distinguishes local emulators from USB and
  // network devices. Require one explicit connected serial, never auto-pick.
  if (!/^emulator-\d+$/.test(deviceId))
    fail("Android target must be a local emulator serial");
  const devices = read("adb", ["devices"]).split("\n");
  if (!devices.some((line) => line.trim() === `${deviceId}\tdevice`)) {
    fail(`${deviceId} is not a connected Android emulator`);
  }
  if (
    !read("adb", ["-s", deviceId, "shell", "pm", "path", APP_ID]).includes(
      "package:",
    )
  ) {
    fail(`${APP_ID} is not installed on ${deviceId}`);
  }
} else {
  const groups = Object.values(
    JSON.parse(read("xcrun", ["simctl", "list", "devices", "booted", "-j"]))
      .devices,
  );
  if (
    !groups
      .flat()
      .some((device) => device.udid === deviceId && device.state === "Booted")
  ) {
    fail(`${deviceId} is not a booted iOS Simulator`);
  }
  read("xcrun", ["simctl", "get_app_container", deviceId, APP_ID, "app"]);
}

const flow = join(dirname(fileURLToPath(import.meta.url)), "smoke.yaml");
// CI and local audits can keep screenshots/logs in their own temporary folder.
const artifactsDir = process.env.CONPAWS_E2E_ARTIFACTS_DIR;
const result = spawnSync(
  "maestro",
  [
    `--platform=${platform}`,
    `--udid=${deviceId}`,
    "test",
    ...(artifactsDir
      ? ["--debug-output", artifactsDir, "--test-output-dir", artifactsDir]
      : []),
    "-e",
    `APP_ID=${APP_ID}`,
    flow,
  ],
  {
    stdio: "inherit",
  },
);
if (result.error) fail(`Maestro could not start: ${result.error.message}`);
process.exit(result.status ?? 1);
