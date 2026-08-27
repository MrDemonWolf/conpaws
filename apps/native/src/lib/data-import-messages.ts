import type { TFunction } from "i18next";
import type { ImportOutcome } from "@/services/data-import";

export interface ImportMessage {
  title: string;
  body: string;
}

/**
 * Which translated sentence explains a failure code.
 *
 * Looked up rather than switched so an outcome carrying a code this build has
 * never heard of -- a backup written by a later version, a code added to the
 * service after this screen was written -- still gets a sentence instead of an
 * empty alert.
 */
const ERROR_KEYS: Record<string, string> = {
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

/**
 * The alert an import outcome deserves, or null when it deserves none.
 *
 * A cancelled run is not a failure: the user closed the picker or backed out
 * of the confirmation, and telling them what they just did is noise.
 */
export function importOutcomeMessage(
  outcome: ImportOutcome,
  t: TFunction,
): ImportMessage | null {
  if (outcome.ok) {
    const nothingAdded =
      outcome.conventionsAdded === 0 && outcome.eventsAdded === 0;

    return {
      title: t("settings.dataImport.successTitle"),
      body: nothingAdded
        ? t("settings.dataImport.successNothing")
        : [
            t("settings.dataImport.successSummary", {
              conventions: outcome.conventionsAdded,
              events: outcome.eventsAdded,
            }),
            outcome.skipped > 0
              ? t("settings.dataImport.successSkipped", {
                  count: outcome.skipped,
                })
              : null,
          ]
            .filter(Boolean)
            .join(" "),
    };
  }

  if (outcome.code === "cancelled") return null;

  return {
    title: t("settings.dataImport.failedTitle"),
    body: t(
      `settings.dataImport.errors.${ERROR_KEYS[outcome.code] ?? "generic"}`,
    ),
  };
}
