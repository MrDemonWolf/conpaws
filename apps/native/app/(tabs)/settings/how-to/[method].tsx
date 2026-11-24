import {
  Redirect,
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HowToWalkthrough } from "@/components/how-to/HowToWalkthrough";
import { HOW_TO_GUIDES, isHowToMethod } from "@/lib/how-to";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";

/**
 * One "Show me how" walkthrough, pushed from Settings > Getting started.
 *
 * A pushed route rather than a modal: the last step opens Find or Import in
 * the Home tab, which a route can do in one call, while a modal would first
 * have to finish closing. The import screen hosts the same walkthrough in a
 * modal instead (`HowToModal`), because it is itself a sheet.
 */
export default function HowToScreen() {
  const { t } = useTranslation();
  const { method } = useLocalSearchParams<{ method?: string }>();
  const lock = useRef(0);

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(lock);
    }, []),
  );

  // A deep link can carry anything; only a known guide renders.
  if (!isHowToMethod(method))
    return <Redirect href="/settings/getting-started" />;
  const guide = HOW_TO_GUIDES[method];

  return (
    <>
      <Stack.Screen options={{ title: t(guide.title) }} />
      <HowToWalkthrough
        key={method}
        method={method}
        finishLabel={t(guide.finishLabel)}
        onFinish={() => {
          if (!tryAcquirePresentationLock(lock)) return;
          // Leave the Settings tab on Getting started rather than on this last
          // step, then open Find or Import in the Home tab.
          router.back();
          router.push(guide.destination);
        }}
        onClose={() => router.back()}
      />
    </>
  );
}
