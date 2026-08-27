import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { ImportOutcome } from "@/services/data-import";
import { importOutcomeMessage } from "./data-import-messages";

// Echoes the key and any interpolation, so a test can assert which message was
// chosen without depending on the English copy.
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}(${JSON.stringify(values)})` : key) as unknown as TFunction;

function success(
  overrides: Partial<Extract<ImportOutcome, { ok: true }>> = {},
): ImportOutcome {
  return {
    ok: true,
    conventionsAdded: 1,
    eventsAdded: 2,
    skipped: 0,
    reasons: { duplicate: 0, orphan: 0, malformed: 0, "invalid-date": 0 },
    ...overrides,
  };
}

describe("importOutcomeMessage", () => {
  it("says nothing when the user cancelled", () => {
    expect(
      importOutcomeMessage({ ok: false, code: "cancelled" }, t),
    ).toBeNull();
  });

  it("summarises what was added", () => {
    const message = importOutcomeMessage(success(), t);

    expect(message?.title).toBe("settings.dataImport.successTitle");
    expect(message?.body).toContain("settings.dataImport.successSummary");
    expect(message?.body).toContain('"conventions":1');
    expect(message?.body).toContain('"events":2');
  });

  it("adds the skipped count only when something was skipped", () => {
    expect(importOutcomeMessage(success(), t)?.body).not.toContain(
      "successSkipped",
    );
    expect(importOutcomeMessage(success({ skipped: 3 }), t)?.body).toContain(
      "settings.dataImport.successSkipped",
    );
  });

  it("says so when a valid backup added nothing", () => {
    const message = importOutcomeMessage(
      success({ conventionsAdded: 0, eventsAdded: 0, skipped: 4 }),
      t,
    );

    expect(message?.body).toBe("settings.dataImport.successNothing");
  });

  it("maps every failure code to its own sentence", () => {
    const cases: Record<string, string> = {
      unreadable: "unreadable",
      "file-too-large": "fileTooLarge",
      "invalid-json": "invalidJson",
      "not-an-object": "invalidJson",
      "unsupported-version": "unsupportedVersion",
      "not-conpaws": "notConPaws",
      "missing-data": "malformed",
      "malformed-data": "malformed",
      "too-many-rows": "tooManyRows",
      "write-failed": "writeFailed",
    };

    for (const [code, key] of Object.entries(cases)) {
      const message = importOutcomeMessage(
        { ok: false, code } as ImportOutcome,
        t,
      );
      expect(message?.title).toBe("settings.dataImport.failedTitle");
      expect(message?.body).toBe(`settings.dataImport.errors.${key}`);
    }
  });

  it("falls back to a generic sentence for an unknown code", () => {
    const message = importOutcomeMessage(
      { ok: false, code: "something-new" } as unknown as ImportOutcome,
      t,
    );

    expect(message?.body).toBe("settings.dataImport.errors.generic");
  });
});
