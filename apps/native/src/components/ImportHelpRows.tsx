import type { TFunction } from "i18next";
import type { ReactElement } from "react";
import { FieldRow } from "@/components/ui/FieldRow";

/**
 * The three import help rows -- Sched, an .ics file, and asking the
 * convention -- shown in the import screen's collapsible help and in Settings
 * > Getting started.
 *
 * Called as a function, never wrapped in a component: Android's
 * `FieldGroup.Section` keeps only a bare universal `ListItem` as a flat row,
 * and wraps anything else in a second card.
 */
export function importHelpRows(t: TFunction): ReactElement[] {
  return [
    <FieldRow key="sched" supportingText={t("import.help.sched")}>
      {t("import.help.schedTitle")}
    </FieldRow>,
    <FieldRow key="ics" supportingText={t("import.help.ics")}>
      {t("import.help.icsTitle")}
    </FieldRow>,
    <FieldRow key="ask" supportingText={t("import.help.ask")}>
      {t("import.help.askTitle")}
    </FieldRow>,
  ];
}
