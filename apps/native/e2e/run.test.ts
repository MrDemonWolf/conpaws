import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const runner = fileURLToPath(new URL("./run.mjs", import.meta.url));

function runInvalidArgs(args: string[]) {
  // An empty PATH makes any accidental adb, simctl, or Maestro call fail. The
  // accepted cases must exit at their argument boundary before device probing.
  return spawnSync(process.execPath, [runner, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: "" },
    timeout: 2_000,
  });
}

describe("native E2E device guard", () => {
  it.each(["production", "constructor", "toString", "__proto__"])(
    "rejects the %s variant before probing",
    (variant) => {
      const result = runInvalidArgs([variant, "android", "emulator-5554"]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("usage:");
      expect(result.stderr).not.toContain("adb");
    },
  );

  it.each([
    ["preview", "android", "RF8R1234567", "local emulator serial"],
    ["development", "web", "emulator-5554", "usage:"],
    ["preview", "ios", "", "usage:"],
  ])("rejects invalid target %j %j %j before probing", (...args) => {
    const expected = args.pop();
    const result = runInvalidArgs(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expected);
    expect(result.stderr).not.toContain("failed");
  });
});
