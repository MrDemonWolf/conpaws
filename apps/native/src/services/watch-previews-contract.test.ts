import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SwiftUI previews and the sample schedules they draw belong to Debug builds
 * only. A `#Preview` outside `#if DEBUG` compiles its fixtures into the
 * Release Watch app or widget extension, which then ships code no one runs.
 * No CI job compiles the Watch targets, so this reads their sources.
 */
const here = dirname(fileURLToPath(import.meta.url));
const targets = resolve(here, "../../targets");

const swiftFiles = readdirSync(targets, { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".swift"))
  .sort();

/** The 1-based lines of each `#Preview` that no `#if DEBUG` encloses. */
function ungatedPreviewLines(source: string): number[] {
  // One entry per open `#if`: whether that branch is Debug-only.
  const branches: boolean[] = [];
  const ungated: number[] = [];
  source.split("\n").forEach((line, index) => {
    const directive = line.trim();
    if (/^#if\b/.test(directive)) {
      branches.push(/^#if\s+DEBUG\s*$/.test(directive));
    } else if (/^#(else|elseif)\b/.test(directive)) {
      branches[branches.length - 1] = /^#elseif\s+DEBUG\s*$/.test(directive);
    } else if (/^#endif\b/.test(directive)) {
      branches.pop();
    } else if (/^#Preview\b/.test(directive) && !branches.includes(true)) {
      ungated.push(index + 1);
    }
  });
  return ungated;
}

describe("Watch previews", () => {
  const withPreviews = swiftFiles.filter((path) =>
    readFileSync(join(targets, path), "utf8").includes("#Preview"),
  );

  it("reads the targets' Swift sources", () => {
    expect(withPreviews.length).toBeGreaterThan(0);
  });

  it.each(withPreviews)("%s keeps every preview in #if DEBUG", (path) => {
    expect(
      ungatedPreviewLines(readFileSync(join(targets, path), "utf8")),
    ).toEqual([]);
  });

  it("tells a Debug-only branch from the rest", () => {
    const source = [
      "#Preview {}", // 1: no #if at all
      "#if DEBUG",
      "#Preview {}", // 3: gated
      "#else",
      "#Preview {}", // 5: the Release branch
      "#endif",
      "#if os(watchOS)",
      "#Preview {}", // 8: another condition
      "#endif",
    ].join("\n");
    expect(ungatedPreviewLines(source)).toEqual([1, 5, 8]);
  });
});
