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

describe("convention create form validation", () => {
  const source = read("app/(tabs)/(home)/convention/create.tsx");

  // Create used to check only for a non-empty name, so a 90-character paste
  // was saved, and Edit, which enforces the shared 80-character limit, then
  // refused every later change until that name was shortened.
  it("gates Add on the validator the edit form uses", () => {
    expect(source).toMatch(
      /import \{[^}]*\bvalidateConventionForm\b[^}]*\} from "@\/lib\/convention-form";/,
    );
    expect(source).toMatch(/const canCreate =\s*!saving && validation\.valid;/);
  });

  it("writes the validator's cleaned name and location, checked again with the zone the save settled on", () => {
    expect(source).toMatch(
      /validateConventionForm\(\{\s*\.\.\.values,\s*timeZone: resolvedTimeZone,?\s*\}\)/,
    );
    const draft = between(
      source,
      "commitNewConvention(",
      "create: conventionsRepo.create",
    );
    expect(draft).toMatch(/\bname: cleaned\.name,/);
    expect(draft).toMatch(/\blocation: cleaned\.location \|\| null,/);
    expect(draft).not.toMatch(/\btrimmedName\b/);
  });
});

describe("convention form footers", () => {
  // @expo/ui keeps only the last FieldGroup.SectionFooter of a section, so a
  // notice in any earlier footer never reaches the screen. Edit kept the name
  // limit, the name counter and the long-span warning in footers of their own
  // ahead of the time zone help: Save greyed out over a too-long name with the
  // reason never shown. Create lost its location note the same way.
  it.each(screens)(
    "%s gives its section one footer, which carries every note",
    (screen) => {
      const section = between(
        read(screen),
        "<FieldGroup.Section>",
        "</FieldGroup.Section>",
      );
      expect(section.match(/<FieldGroup\.SectionFooter>/g) ?? []).toHaveLength(
        1,
      );
      const footer = section.slice(
        section.indexOf("<FieldGroup.SectionFooter>"),
      );
      expect(footer).toMatch(/\bconventionFormFooter\(\s*validation,\s*t\b/);
    },
  );

  it("adds the location note on create wherever the location sets the zone", () => {
    const section = between(
      read("app/(tabs)/(home)/convention/create.tsx"),
      "<FieldGroup.Section>",
      "</FieldGroup.Section>",
    );
    expect(section).toMatch(
      /conventionFormFooter\(\s*validation,\s*t,\s*\{\s*locationSetsTimeZone: canInferTimeZone,?\s*\}\s*\)/,
    );
  });
});

it("uses the same localized date summary on both iOS rows", () => {
  const ios = between(
    read("src/components/ConventionFormFields.tsx"),
    'if (process.env.EXPO_OS === "ios")',
    "dialog: null",
  );
  expect(ios).toContain("formatMediumDate(value, locale)");
  expect(ios).toContain("range={{ start: minimumDate }}");
});
