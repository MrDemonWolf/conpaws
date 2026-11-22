import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { openExternal } from "@/lib/open-external";

/**
 * `openExternal` with its error alert translated, for a screen's link rows.
 *
 * One place that catches the two rejections these links actually produce: a
 * second tap while a browser is already up, and a `mailto:` on a device with
 * no mail account. Both used to be unhandled and silent.
 */
export function useOpenLink(): (url: string) => void {
  const { t } = useTranslation();
  return useCallback(
    (url: string) => {
      void openExternal(url, {
        errorTitle: t("common.error"),
        errorMessage: t("common.openLinkError"),
      });
    },
    [t],
  );
}
