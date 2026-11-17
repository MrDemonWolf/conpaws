import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");

/** Every `leading={...}` / `trailing={...}` expression in a source file. */
function slotExpressions(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/\b(?:leading|trailing)=\{/g)) {
    let depth = 1;
    let i = (match.index ?? 0) + match[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    out.push(source.slice(start, i - 1));
  }
  return out;
}

describe("list row slots", () => {
  it("never hand a Compose row slot a React Native spinner", () => {
    // On Android these rows are Compose ListItems. A React Native
    // ActivityIndicator in a slot cannot be measured, takes the full width and
    // squeezes the row's text to one letter per line. Use RowSpinner.
    const files = ["app", "src"]
      .flatMap((dir) =>
        (
          readdirSync(path.join(root, dir), { recursive: true }) as string[]
        ).map((file) => path.join(root, dir, file)),
      )
      .filter((file) => /\.tsx$/.test(file) && !/\.test\.tsx$/.test(file));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!/FieldRow|ListItem/.test(source)) continue;
      for (const slot of slotExpressions(source))
        if (slot.includes("ActivityIndicator"))
          offenders.push(path.relative(root, file));
    }
    expect(files.length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});
