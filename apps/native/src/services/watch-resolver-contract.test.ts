import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HOUR_MS } from "@/lib/schedule-browse";
import { WATCH_LONGEST_COUNTED_PANEL_MS } from "./watch-snapshot";

/**
 * The phone leaves out of the Watch payload every convention the Watch's
 * resolver can no longer choose, so the two must agree on when a convention
 * stops counting. The Swift is compiled only into the Watch targets and
 * swift-tests, so this reads it and holds the TypeScript mirror to it.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), "utf8");
const resolver = read("../../targets/_shared/ConPawsScheduleState.swift");
const snapshot = read("./watch-snapshot.ts");

const swiftLastActive =
  resolver.match(/static func lastActiveMs\([\s\S]*?\n {2}\}/)?.[0] ?? "";
const tsLastActive =
  snapshot.match(/export function watchLastActiveMs\([\s\S]*?\n\}/)?.[0] ?? "";

describe("Watch resolver contract", () => {
  it("counts a saved panel to its end, a day from its start at most", () => {
    expect(swiftLastActive).toContain(
      "convention.events.reduce(convention.endAtMs)",
    );
    expect(swiftLastActive).toContain(
      "min(effectiveEndMs(of: event), event.startAtMs + longestCountedPanelMs)",
    );
    expect(resolver).toContain("event.endAtMs ?? event.startAtMs + 3_600_000");
    expect(HOUR_MS).toBe(3_600_000);
    expect(tsLastActive).toContain("convention.endAtMs");
    expect(tsLastActive).toContain(
      "event.endAtMs ?? event.startAtMs + HOUR_MS",
    );
    expect(tsLastActive).toContain(
      "event.startAtMs + WATCH_LONGEST_COUNTED_PANEL_MS",
    );
  });

  it("caps a panel at the same length on both sides", () => {
    const swift = resolver.match(
      /static let longestCountedPanelMs: Double = ([\d_]+)/,
    )?.[1];
    expect(Number(swift?.replaceAll("_", ""))).toBe(
      WATCH_LONGEST_COUNTED_PANEL_MS,
    );
  });

  it("chooses among active conventions, else the one that ends last", () => {
    // What lets the phone drop every other ended convention.
    expect(resolver).toContain(
      "snapshot.conventions.filter { lastActiveMs(of: $0) >= nowMs }",
    );
    expect(resolver).toContain(
      "?? snapshot.conventions.max { $0.endAtMs < $1.endAtMs }",
    );
  });

  it("never has the Watch pick a convention by id", () => {
    // A convention picked by id could be one the phone left out as over.
    const sources = ["watch", "watch-widget", "_shared"].flatMap((target) => {
      const folder = `../../targets/${target}`;
      return readdirSync(resolve(here, folder))
        .filter((name) => name.endsWith(".swift"))
        .map((name) => read(`${folder}/${name}`));
    });
    const picks = sources.flatMap((source) =>
      [...source.matchAll(/selectedConventionID: (?!String\?)([^,)\n]+)/g)].map(
        (match) => match[1],
      ),
    );
    expect(picks.length).toBeGreaterThan(0);
    expect(new Set(picks)).toEqual(new Set(["nil"]));
  });
});
