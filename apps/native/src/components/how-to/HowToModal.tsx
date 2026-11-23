import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SheetHeader } from "@/components/schedule/SheetHeader";
import { SafeView } from "@/components/ui";
import { HOW_TO_GUIDES, type ImportHelpMethod } from "@/lib/how-to";
import { HowToWalkthrough } from "./HowToWalkthrough";

/** One opening of the help. `openedAt` makes reopening a method start over. */
export interface HowToRequest {
  method: ImportHelpMethod;
  openedAt: number;
}

/**
 * The "Show me how" walkthrough over the import screen. Closing it reveals
 * the real Import screen, so its last button is "Try it now" and just closes.
 *
 * A full-screen React Native Modal, not a pushed route or a page sheet: the
 * import screen is itself an iOS form sheet, and iOS drops a sheet presented
 * from a sheet (the same rule as `TimeZonePickerModal`). Android ignores
 * `presentationStyle`.
 */
export function HowToModal({
  request,
  onClose,
}: {
  request: HowToRequest | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  // Keeps the last content while the modal slides out. Set during render,
  // React's pattern for state derived from a changed prop: no ref writes.
  const [shown, setShown] = useState<HowToRequest | null>(request);
  if (request !== null && request !== shown) setShown(request);

  return (
    <Modal
      visible={request !== null}
      presentationStyle="fullScreen"
      animationType={reduceMotion ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      {/* Its own provider, or the modal inherits the form sheet's top inset
          of 0 and draws under the status bar (see TimeZonePickerModal). */}
      <SafeAreaProvider>
        <SafeView edges={["top"]}>
          {shown ? (
            <>
              <SheetHeader
                title={t(HOW_TO_GUIDES[shown.method].title)}
                closeLabel={t("howTo.close")}
                onClose={onClose}
              />
              <HowToWalkthrough
                key={shown.openedAt}
                method={shown.method}
                finishLabel={t("howTo.tryItNow")}
                onFinish={onClose}
                onClose={onClose}
              />
            </>
          ) : null}
        </SafeView>
      </SafeAreaProvider>
    </Modal>
  );
}
