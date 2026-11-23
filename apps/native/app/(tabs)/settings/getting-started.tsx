import { router, useFocusEffect } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { HowToMethodCard } from "@/components/how-to/HowToMethodCard";
import { SectionHeader } from "@/components/SectionHeader";
import { Row, Text } from "@/components/ui";
import { useContentWidth } from "@/hooks/useContentWidth";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { HOW_TO_METHODS } from "@/lib/how-to";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import { themeTokens } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";

/**
 * The three ways to get a schedule into ConPaws, each with a picture and a
 * "Show me how" walkthrough, then the shortcuts to start.
 *
 * A plain React Native ScrollView, not `SettingsFieldGroupScreen`: the
 * pictures are React Native views, and those cannot sit reliably in an
 * `@expo/ui` list. On Android an `RNHostView` draws nothing inside the list
 * and a React Native view in a row slot crashes; on iOS it only works at a
 * fixed width, which breaks with large text. Licenses is the same kind of
 * Settings screen and keeps its collapsing large title the same way.
 *
 * The import screen's collapsible help shows the short version of the same
 * tips (`importHelpRows`) with the same walkthroughs.
 */
export default function GettingStartedScreen() {
  const { t } = useTranslation();
  const lock = useRef(0);
  const tokens = themeTokens[useResolvedColorScheme()];
  // Cards, headers and rows move into the readable column on a wide window;
  // zero on a phone in portrait (the Find screen's pattern).
  const { listPadding } = useContentWidth();
  const contentStyle = useMemo(
    () => ({ paddingBottom: 32, ...listPadding }),
    [listPadding],
  );

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(lock);
    }, []),
  );

  function present(go: () => void) {
    if (tryAcquirePresentationLock(lock)) go();
  }

  const rows = [
    {
      key: "find",
      title: t("settings.help.find"),
      description: t("settings.help.findDescription"),
      testID: "getting-started-find",
      go: () => router.push("/convention/find"),
    },
    {
      key: "import",
      title: t("settings.help.importNow"),
      description: t("settings.help.importNowDescription"),
      testID: "getting-started-import",
      go: () => router.push("/convention/new/import"),
    },
    {
      key: "replay",
      title: t("settings.help.replay"),
      description: t("settings.help.replayDescription"),
      testID: "getting-started-replay",
      go: () =>
        router.push({
          pathname: "/(onboarding)/welcome",
          params: { replay: "1" },
        }),
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={contentStyle}
    >
      <Text variant="body" className="px-4 pt-2 pb-4 text-muted-foreground">
        {t("howTo.intro")}
      </Text>
      <View className="gap-3 px-4">
        {HOW_TO_METHODS.map((method) => (
          <HowToMethodCard
            key={method}
            method={method}
            onShowMe={() =>
              present(() =>
                router.push({
                  pathname: "/settings/how-to/[method]",
                  params: { method },
                }),
              )
            }
          />
        ))}
      </View>

      <SectionHeader title={t("howTo.askTitle")} />
      <Text variant="body" className="px-4 text-muted-foreground">
        {t("import.help.ask")}
      </Text>

      <SectionHeader title={t("howTo.startTitle")} />
      {/* The grouped rows of Licenses, in the same Settings stack. */}
      <View className="px-4">
        {rows.map((row, index) => (
          <Row
            key={row.key}
            testID={row.testID}
            onPress={() => present(row.go)}
            className={cn(
              "border-r border-b border-l border-border bg-card px-4 py-2.5",
              index === 0 && "rounded-t-xl border-t",
              index === rows.length - 1 && "rounded-b-xl",
            )}
            trailing={<ChevronRight size={18} color={tokens.mutedForeground} />}
          >
            <Text variant="label" className="font-semibold">
              {row.title}
            </Text>
            <Text variant="caption">{row.description}</Text>
          </Row>
        ))}
      </View>
      <Text variant="caption" className="px-4 pt-2">
        {t("convention.scheduleHint.body")}
      </Text>
    </ScrollView>
  );
}
