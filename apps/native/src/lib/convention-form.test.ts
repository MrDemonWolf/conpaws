import { describe, expect, it } from "vitest";
import {
  CONVENTION_NAME_MAX_LENGTH,
  conventionNameLength,
  isConventionUnchanged,
  normalizeConventionName,
  validateConventionForm,
} from "./convention-form";

const VALID = {
  name: "IndyFurCon 2026",
  startDate: "2026-09-03",
  endDate: "2026-09-06",
  timeZone: "America/Indiana/Indianapolis",
};

describe("normalizeConventionName", () => {
  it("collapses the whitespace a web-page paste drags in", () => {
    expect(normalizeConventionName("  Indy   FurCon\n2026 ")).toBe(
      "Indy FurCon 2026",
    );
  });

  it("leaves an already-clean name alone", () => {
    expect(normalizeConventionName("IndyFurCon 2026")).toBe("IndyFurCon 2026");
  });
});

describe("conventionNameLength", () => {
  it("counts an emoji as one character, not two", () => {
    // "🐺" is a surrogate pair; naive .length would report 2.
    expect(conventionNameLength("🐺")).toBe(1);
    expect("🐺".length).toBe(2);
  });

  it("measures the normalized name, not the raw input", () => {
    expect(conventionNameLength("  a   b  ")).toBe(3);
  });
});

describe("validateConventionForm", () => {
  it("accepts a well-formed convention", () => {
    const result = validateConventionForm(VALID);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.cleaned.name).toBe("IndyFurCon 2026");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateConventionForm({ ...VALID, name: "" }).errors.name).toBe(
      "nameRequired",
    );
    expect(validateConventionForm({ ...VALID, name: "   " }).errors.name).toBe(
      "nameRequired",
    );
  });

  it("enforces the name length bound the database does not", () => {
    const atLimit = "x".repeat(CONVENTION_NAME_MAX_LENGTH);
    expect(validateConventionForm({ ...VALID, name: atLimit }).valid).toBe(
      true,
    );

    const overLimit = "x".repeat(CONVENTION_NAME_MAX_LENGTH + 1);
    expect(
      validateConventionForm({ ...VALID, name: overLimit }).errors.name,
    ).toBe("nameTooLong");
  });

  it("measures length after normalizing, so padding cannot trip the limit", () => {
    const padded = `   ${"x".repeat(CONVENTION_NAME_MAX_LENGTH)}   `;
    expect(validateConventionForm({ ...VALID, name: padded }).valid).toBe(true);
  });

  it("rejects an end date before the start", () => {
    expect(
      validateConventionForm({
        ...VALID,
        startDate: "2026-09-06",
        endDate: "2026-09-03",
      }).errors.endDate,
    ).toBe("endBeforeStart");
  });

  it("allows a single-day convention", () => {
    expect(
      validateConventionForm({
        ...VALID,
        startDate: "2026-09-03",
        endDate: "2026-09-03",
      }).valid,
    ).toBe(true);
  });

  it("rejects a time zone this device cannot resolve", () => {
    expect(
      validateConventionForm({ ...VALID, timeZone: "Mars/Olympus" }).errors
        .timeZone,
    ).toBe("timeZoneInvalid");
    expect(
      validateConventionForm({ ...VALID, timeZone: "  " }).errors.timeZone,
    ).toBe("timeZoneInvalid");
  });

  it("reports every broken field at once rather than one at a time", () => {
    const result = validateConventionForm({
      name: "",
      startDate: "2026-09-06",
      endDate: "2026-09-03",
      timeZone: "Nope/Nope",
    });
    expect(result.errors).toEqual({
      name: "nameRequired",
      endDate: "endBeforeStart",
      timeZone: "timeZoneInvalid",
    });
  });

  it("warns about an implausibly long span without blocking the save", () => {
    const result = validateConventionForm({
      ...VALID,
      startDate: "2026-09-03",
      endDate: "2027-09-03",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.longSpan).toBe(365);
  });

  it("does not warn about a normal-length convention", () => {
    expect(validateConventionForm(VALID).warnings.longSpan).toBeUndefined();
  });

  it("treats an unparseable date as out of order rather than valid", () => {
    expect(
      validateConventionForm({ ...VALID, endDate: "not-a-date" }).errors
        .endDate,
    ).toBe("endBeforeStart");
  });
});

describe("isConventionUnchanged", () => {
  it("ignores whitespace-only edits to the name", () => {
    expect(
      isConventionUnchanged({ ...VALID, name: "  IndyFurCon   2026 " }, VALID),
    ).toBe(true);
  });

  it("detects a real edit to any field", () => {
    expect(isConventionUnchanged({ ...VALID, name: "Other" }, VALID)).toBe(
      false,
    );
    expect(
      isConventionUnchanged({ ...VALID, startDate: "2026-09-04" }, VALID),
    ).toBe(false);
    expect(
      isConventionUnchanged({ ...VALID, endDate: "2026-09-07" }, VALID),
    ).toBe(false);
    expect(
      isConventionUnchanged({ ...VALID, timeZone: "America/Chicago" }, VALID),
    ).toBe(false);
  });
});
