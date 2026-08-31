import { FieldGroup, Host, ListItem } from "@expo/ui";
import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { NativeText } from "@/components/ui/NativeText";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";

/**
 * The import guidance as a permanent reference. The same content lives in the
 * import screen's collapsible help; a user who dismissed it there can always
 * find their way back through Settings.
 */
export default function GettingStartedScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section title={t("import.help.title")}>
          <ListItem supportingText={t("import.help.sched")}>
            {t("import.help.schedTitle")}
          </ListItem>
          <ListItem supportingText={t("import.help.ics")}>
            {t("import.help.icsTitle")}
          </ListItem>
          <ListItem supportingText={t("import.help.ask")}>
            {t("import.help.askTitle")}
          </ListItem>
        </FieldGroup.Section>
        <FieldGroup.Section>
          <ListItem
            supportingText={t("settings.help.importNowDescription")}
            onPress={() => router.push("/convention/new/import")}
          >
            {t("settings.help.importNow")}
          </ListItem>
          <FieldGroup.SectionFooter>
            <NativeText>{t("convention.scheduleHint.body")}</NativeText>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
