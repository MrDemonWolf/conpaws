import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("FieldRow", () => {
  it("is the universal ListItem on every platform, so Android draws one surface per row", () => {
    // An Android wrapper made FieldGroup.Section nest a second ListItem in
    // each row: double padding and a pressed outline inside another one.
    for (const platform of ["android", "ios", "native", "web"])
      expect(
        existsSync(path.join(__dirname, `FieldRow.${platform}.tsx`)),
        platform,
      ).toBe(false);
    expect(readFileSync(path.join(__dirname, "FieldRow.tsx"), "utf8")).toMatch(
      /export const FieldRow = ListItem;/,
    );
  });

  it("relies on the installed section styling a universal ListItem as the row", () => {
    const uiRoot = path.dirname(require.resolve("@expo/ui/package.json"));
    const section = readFileSync(
      path.join(uiRoot, "src/universal/FieldGroup/FieldSection.android.tsx"),
      "utf8",
    );
    expect(section).toContain("isUniversalListItem(child)");
    expect(section).toContain("cloneElement(child");
  });
});
