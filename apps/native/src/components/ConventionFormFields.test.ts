import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(__dirname, "../..");
const screens = [
  "app/(tabs)/(home)/convention/create.tsx",
  "app/(tabs)/(home)/convention/[id]/edit.tsx",
];

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  expect(from, start).toBeGreaterThanOrEqual(0);
  expect(to, end).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("convention date fields", () => {
  it.each(screens)(
    "%s hands FieldGroup.Section the date rows themselves and opens their dialogs outside the form's Host",
    (screen) => {
      // On Android the section keeps a row as-is only when it is the universal
      // ListItem. A component that renders one is wrapped in a second Compose
      // ListItem: doubled padding, an inner surface in another shade and a
      // square ripple inside the rounded row.
      const source = read(screen);
      const section = between(
        source,
        "<FieldGroup.Section>",
        "</FieldGroup.Section>",
      );
      expect(section).not.toMatch(/<ConventionDateField\b/);
      expect(section).toContain("{startDateField.row}");
      expect(section).toContain("{endDateField.row}");
      expect(section).not.toMatch(/DateField\.dialog\b/);

      const afterHost = source.slice(source.lastIndexOf("</Host>"));
      expect(afterHost).toContain("{startDateField.dialog}");
      expect(afterHost).toContain("{endDateField.dialog}");
    },
  );

  it("builds the Android row as the bare universal ListItem, with the dialog kept apart from it", () => {
    const source = read("src/components/ConventionFormFields.tsx");
    expect(source).not.toMatch(/export function ConventionDateField\b/);
    expect(source).toMatch(/export function useConventionDateField\b/);
    expect(source).toMatch(/\brow:\s*\(?\s*<ListItem\b/);
    // A fragment holding the row and its picker is what the section wrapped.
    expect(source).not.toMatch(/<>\s*<ListItem\b[\s\S]*?<DateTimePicker\b/);
    expect(source).toMatch(
      /import \{ FieldRow as ListItem \} from "@\/components\/ui\/FieldRow";/,
    );
  });
});
