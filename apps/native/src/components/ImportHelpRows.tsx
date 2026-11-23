import type { TFunction } from "i18next";
import type { ReactElement } from "react";
import { NavigationIndicator } from "@/components/icons";
import { FieldRow } from "@/components/ui/FieldRow";
import { HOW_TO_GUIDES, type ImportHelpMethod } from "@/lib/how-to";

/**
 * The import help rows -- Sched, an .ics file, and asking the convention --
 * shown only in the import screen's collapsible help. Settings > Getting
 * started has its own picture cards for the same methods.
 *
 * Each method's tip is followed by a "Show me how" row that opens the same
 * walkthrough as the Getting started card. The tips are static and look
 * alike, so the chevron is what tells the reader that row can be tapped.
 *
 * Called as a function, never wrapped in a component: Android's
 * `FieldGroup.Section` keeps only a bare universal `ListItem` as a flat row,
 * and wraps anything else in a second card.
 */
export function importHelpRows(
  t: TFunction,
  onShowMe: (method: ImportHelpMethod) => void,
): ReactElement[] {
  const showMeRow = (method: ImportHelpMethod) => (
    <FieldRow
      key={`${method}-how`}
      supportingText={t(HOW_TO_GUIDES[method].title)}
      trailing={<NavigationIndicator />}
      testID={`import-help-show-${method}`}
      onPress={() => onShowMe(method)}
    >
      {t("howTo.showMe")}
    </FieldRow>
  );

  return [
    <FieldRow key="sched" supportingText={t("import.help.sched")}>
      {t("import.help.schedTitle")}
    </FieldRow>,
    showMeRow("sched"),
    <FieldRow key="ics" supportingText={t("import.help.ics")}>
      {t("import.help.icsTitle")}
    </FieldRow>,
    showMeRow("ics"),
    <FieldRow key="ask" supportingText={t("import.help.ask")}>
      {t("import.help.askTitle")}
    </FieldRow>,
  ];
}
