import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Saved panels the convention withdrew reach the Watch in a list of their
 * own. The phone writes it (watch-snapshot.ts) and the Watch decodes it
 * (targets/_shared, compiled only into the Watch targets and swift-tests), so
 * a key or status spelled differently on one side drops every mark without an
 * error anywhere. This reads both sides and holds them together, and holds the
 * live lists to leaving withdrawn panels out.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), "utf8");
const shared = read("../../targets/_shared/ConPawsSnapshot.swift");
const payload = read("./watch-snapshot.ts");
const widget = read("./widget-snapshot.ts");
const schema = read("../db/schema.ts");

const sharedWithdrawn =
  shared.match(/struct ConPawsWithdrawnEvent[\s\S]*?\n\}/)?.[0] ?? "";

describe("Watch withdrawn panel contract", () => {
  it("uses one key on the phone and the Watch", () => {
    expect(payload).toContain("withdrawn?: WatchWithdrawnSnapshot[];");
    expect(shared).toContain("var withdrawn: [ConPawsWithdrawnEvent]? = nil");
    expect(shared).toContain(
      "withdrawn = try? container.decodeIfPresent([ConPawsWithdrawnEvent].self, forKey: .withdrawn)",
    );
  });

  it("agrees on the status field and its values", () => {
    const swiftStatuses = [
      ...(
        sharedWithdrawn.match(/enum Status[^{]*\{([\s\S]*?)\n {2}\}/)?.[1] ?? ""
      ).matchAll(/case (\w+)/g),
    ].map((match) => match[1]);
    const feedStatuses = JSON.parse(
      (
        schema.match(/feed_status", \{ enum: (\[[^\]]*\]) \}/)?.[1] ?? "[]"
      ).replaceAll("'", '"'),
    );
    expect(swiftStatuses).toEqual(["cancelled", "removed"]);
    expect(feedStatuses).toEqual(swiftStatuses);
    expect(sharedWithdrawn).toMatch(
      /enum CodingKeys[^{]*\{\s*case status\s*\}/,
    );
    expect(payload).toContain("status: WatchWithdrawnStatus;");
  });

  it("decodes the row flat, as the phone writes it", () => {
    expect(payload).toContain(
      "export type WatchWithdrawnSnapshot = WidgetEventSnapshot & {",
    );
    expect(sharedWithdrawn).toContain(
      "event = try ConPawsEventSnapshot(from: decoder)",
    );
    expect(sharedWithdrawn).toContain("try event.encode(to: encoder)");
  });

  it("keeps withdrawn panels out of every live list", () => {
    // The phone widget, Up Next and Android read only `events`.
    expect(widget).toContain("if (event.feedStatus !== null) return null;");
    // Nor do the Watch's resolver and complication read the new list.
    for (const file of [
      "ConPawsScheduleState.swift",
      "ConPawsScheduleStateParts.swift",
      "ConPawsComplicationTimeline.swift",
      "ConPawsComplicationSpeech.swift",
    ]) {
      expect(read(`../../targets/_shared/${file}`)).not.toContain("withdrawn");
    }
  });
});
