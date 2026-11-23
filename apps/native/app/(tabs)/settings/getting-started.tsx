import { FieldGroup } from "@expo/ui";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { importHelpRows } from "@/components/ImportHelpRows";
import { SettingsFieldGroupScreen } from "@/components/SettingsFieldGroupScreen";
import { FieldRow } from "@/components/ui/FieldRow";
import { NativeText } from "@/components/ui/NativeText";

/**
 * The import guidance as a permanent reference. The same rows
 * (`importHelpRows`) sit in the import screen's collapsible help; a user who
 * dismissed it there can always find their way back through Settings.
 */
export default function GettingStartedScreen() {
  const { t } = useTranslation();

  return (
    <SettingsFieldGroupScreen>
      <FieldGroup.Section title={t("import.help.title")}>
        {importHelpRows(t)}
      </FieldGroup.Section>
      <FieldGroup.Section>
        <FieldRow
          supportingText={t("settings.help.findDescription")}
          onPress={() => router.push("/convention/find")}
        >
          {t("settings.help.find")}
        </FieldRow>
        <FieldRow
          supportingText={t("settings.help.importNowDescription")}
          onPress={() => router.push("/convention/new/import")}
        >
          {t("settings.help.importNow")}
        </FieldRow>
        <FieldRow
          supportingText={t("settings.help.replayDescription")}
          onPress={() =>
            router.push({
              pathname: "/(onboarding)/welcome",
              params: { replay: "1" },
            })
          }
        >
          {t("settings.help.replay")}
        </FieldRow>
        <FieldGroup.SectionFooter>
          <NativeText>{t("convention.scheduleHint.body")}</NativeText>
        </FieldGroup.SectionFooter>
      </FieldGroup.Section>
    </SettingsFieldGroupScreen>
  );
}
