import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formTitleOnOwnRow } from "./FormModalHeader.shared";

describe("formTitleOnOwnRow", () => {
  it("keeps the title between Cancel and Save on a phone at default text size", () => {
    expect(formTitleOnOwnRow(393, 1)).toBe(false);
    expect(formTitleOnOwnRow(412, 1.3)).toBe(false);
    expect(formTitleOnOwnRow(360, 1)).toBe(false);
  });

  it("moves the title to its own row for large text or a narrow window", () => {
    expect(formTitleOnOwnRow(393, 1.4)).toBe(true);
    expect(formTitleOnOwnRow(412, 2)).toBe(true);
    expect(formTitleOnOwnRow(340, 1)).toBe(true);
  });

  it("is the rule the Android form header uses", () => {
    const source = readFileSync(
      path.join(__dirname, "FormModalHeader.android.tsx"),
      "utf8",
    );
    expect(source).toContain("formTitleOnOwnRow(width, fontScale)");
  });
});
