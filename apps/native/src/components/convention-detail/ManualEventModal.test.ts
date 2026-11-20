import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function dateTimeFields(): string[] {
  const source = readFileSync(
    path.join(__dirname, "ManualEventModal.tsx"),
    "utf8",
  );
  return source
    .split("<NativeDateTimeField")
    .slice(1)
    .map((block) => block.slice(0, block.indexOf("/>")));
}

describe("ManualEventModal", () => {
  it("leaves the end-time picker unbounded so an event can end after midnight", () => {
    // On iOS a time-only picker shows a single day and cannot change it, so a
    // minimum of the start time greyed out every earlier clock: a 10 PM to
    // 2 AM dance could not be entered. resolveEndTime already reads an earlier
    // clock as the next day and validatedManualEventEnd rejects a zero
    // duration, so the end needs no bound on the picker itself.
    const end = dateTimeFields().find((block) =>
      block.includes('testID="manual-event-end-picker"'),
    );
    expect(end).toBeDefined();
    expect(end).toMatch(/\bmode="time"/);
    expect(end).not.toMatch(/\b(minimumDate|maximumDate)=/);
  });

  it("bounds no time-only picker, only the date picker", () => {
    const fields = dateTimeFields();
    const timeFields = fields.filter((block) => /\bmode="time"/.test(block));
    expect(timeFields.length).toBeGreaterThanOrEqual(2);
    for (const block of timeFields)
      expect(block).not.toMatch(/\b(minimumDate|maximumDate)=/);
  });

  it("relies on the installed iOS picker turning a minimum into a SwiftUI range", () => {
    // Pins why the rule above matters: @expo/ui hands minimumDate to
    // DatePicker(in: start...), which clamps the hour-and-minute wheel too.
    const uiRoot = path.dirname(require.resolve("@expo/ui/package.json"));
    const picker = readFileSync(
      path.join(uiRoot, "src/community/datetime-picker/DateTimePicker.tsx"),
      "utf8",
    );
    expect(picker).toMatch(/range:\s*minimumDate\s*\|\|\s*maximumDate/);
  });
});
