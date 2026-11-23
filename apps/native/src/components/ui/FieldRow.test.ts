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

  it("draws a string subtitle in the secondary colour on iOS", () => {
    // @expo/ui 58.0.29 styled it with "secondaryLabel", a colour Expo's
    // converter does not know, so the style was dropped and every subtitle
    // drew in the primary colour. patches/@expo%2Fui@58.0.29.patch swaps in
    // the hierarchical secondary style, in the source and the built file.
    const uiRoot = path.dirname(require.resolve("@expo/ui/package.json"));
    for (const file of [
      "src/universal/ListItem/ListItem.ios.tsx",
      "build/universal/ListItem/ListItem.ios.js",
    ]) {
      const source = readFileSync(path.join(uiRoot, file), "utf8");
      expect(source, file).not.toMatch(/color: 'secondaryLabel'/);
      expect(source, file).toMatch(
        /type: 'hierarchical',\s*style: 'secondary'/,
      );
    }
  });
});
