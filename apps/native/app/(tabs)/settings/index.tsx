import ArrowOutwardIcon from "@expo/material-symbols/arrow_outward.xml";
import { FieldGroup, Host, Icon, ListItem } from "@expo/ui";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";
import { developerToolsEnabled } from "@/lib/developer-tools";
import i18n, { type SupportedLanguage } from "@/lib/i18n";
import { useExportData } from "@/services/data-export";
import { useImportData } from "@/services/data-import";

const CHEVRON = Icon.select({
  ios: "chevron.right",
  android: import("@expo/material-symbols/chevron_right.xml"),
});
const EXTERNAL_LINK = Icon.select({
  ios: "arrow.up.right",
  android: ArrowOutwardIcon,
});

function NavigationIndicator() {
  return <Icon name={CHEVRON} size={16} />;
}

function ExternalIndicator() {
  return <Icon name={EXTERNAL_LINK} size={15} />;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { exportData, isLoading: isExporting } = useExportData();
  const { importData, isLoading: isImporting } = useImportData();
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";

  const showDeveloperTools = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={resolvedColorScheme === "dark" ? "#18B7F2" : "#006F91"}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section title={t("settings.app.title")}>
          <ListItem
            supportingText={t(
              `settings.languages.${i18n.language as SupportedLanguage}`,
              { defaultValue: "English" },
            )}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/language")}
          >
            {t("settings.app.language")}
          </ListItem>
          <ListItem
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/about")}
          >
            {t("settings.legal.about")}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section
          title={t("settings.data.title")}
          disabled={isExporting || isImporting}
        >
          <ListItem
            supportingText={
              isExporting ? "Exporting..." : "Save a backup of all your data"
            }
            onPress={isExporting ? undefined : () => exportData()}
          >
            {t("settings.data.exportData")}
          </ListItem>
          <ListItem
            supportingText={
              isImporting ? "Importing..." : "Restore from a backup file"
            }
            onPress={isImporting ? undefined : () => importData()}
          >
            {t("settings.data.importData")}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.legal.title")}>
          <ListItem
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync("https://conpaws.com/privacy")
            }
          >
            {t("settings.legal.privacyPolicy")}
          </ListItem>
          <ListItem
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync("https://conpaws.com/terms")
            }
          >
            {t("settings.legal.termsOfService")}
          </ListItem>
        </FieldGroup.Section>

        {showDeveloperTools ? (
          <FieldGroup.Section title="Developer">
            <ListItem
              supportingText="Replay onboarding safely"
              trailing={<NavigationIndicator />}
              onPress={() => router.push("/settings/debug")}
            >
              Debug Tools
            </ListItem>
            <ListItem
              supportingText="Preview app controls and states"
              trailing={<NavigationIndicator />}
              onPress={() => router.push("/settings/ui-system")}
            >
              UI System
            </ListItem>
          </FieldGroup.Section>
        ) : null}
      </FieldGroup>
    </Host>
  );
}
