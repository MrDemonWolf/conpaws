import ArrowOutwardIcon from "@expo/material-symbols/arrow_outward.xml";
import BugReportIcon from "@expo/material-symbols/bug_report.xml";
import DescriptionIcon from "@expo/material-symbols/description.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import InfoIcon from "@expo/material-symbols/info.xml";
import LanguageIcon from "@expo/material-symbols/language.xml";
import PaletteIcon from "@expo/material-symbols/palette.xml";
import PrivacyIcon from "@expo/material-symbols/privacy_tip.xml";
import UploadIcon from "@expo/material-symbols/upload.xml";
import {
  FieldGroup,
  Host,
  Icon,
  ListItem,
  Switch as NativeSwitch,
} from "@expo/ui";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { useVersionLabel } from "@/hooks/useVersionLabel";
import {
  getAppearancePreference,
  subscribeAppearancePreference,
} from "@/lib/appearance-storage";
import { importOutcomeMessage } from "@/lib/data-import-messages";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { saveHapticsPreference } from "@/lib/haptics-storage";
import i18n, { type SupportedLanguage } from "@/lib/i18n";
import { useExportData } from "@/services/data-export";
import { type ImportOutcome, useImportData } from "@/services/data-import";
import { getHapticsEnabled } from "@/services/haptics";

const CHEVRON = Icon.select({
  ios: "chevron.right",
  android: import("@expo/material-symbols/chevron_right.xml"),
});
const EXTERNAL_LINK = Icon.select({
  ios: "arrow.up.right",
  android: ArrowOutwardIcon,
});
const LANGUAGE = Icon.select({ ios: "globe", android: LanguageIcon });
const ABOUT = Icon.select({ ios: "info.circle", android: InfoIcon });
const EXPORT = Icon.select({
  ios: "square.and.arrow.up",
  android: UploadIcon,
});
const IMPORT = Icon.select({
  ios: "square.and.arrow.down",
  android: DownloadIcon,
});
const PRIVACY = Icon.select({ ios: "hand.raised", android: PrivacyIcon });
const TERMS = Icon.select({ ios: "doc.text", android: DescriptionIcon });
const DEBUG = Icon.select({ ios: "ladybug", android: BugReportIcon });
const UI_SYSTEM = Icon.select({ ios: "paintpalette", android: PaletteIcon });
const APPEARANCE = Icon.select({
  ios: "circle.lefthalf.filled",
  android: PaletteIcon,
});

function LeadingIcon({ name }: { name: ReturnType<typeof Icon.select> }) {
  return <Icon name={name} size={22} />;
}

function NavigationIndicator() {
  return <Icon name={CHEVRON} size={16} />;
}

function ExternalIndicator() {
  return <Icon name={EXTERNAL_LINK} size={15} />;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { exportData, isLoading: isExporting } = useExportData();
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();
  const versionLabel = useVersionLabel();
  const appearance = useSyncExternalStore(
    subscribeAppearancePreference,
    getAppearancePreference,
    getAppearancePreference,
  );

  const showDeveloperTools = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );

  const [haptics, setHaptics] = useState(getHapticsEnabled);

  function handleHapticsChange(next: boolean) {
    // Optimistic so the switch tracks the finger; reverted if the write fails.
    setHaptics(next);
    void saveHapticsPreference(next).catch(() => {
      setHaptics(!next);
      Alert.alert(t("common.error"), t("settings.app.hapticsError"));
    });
  }

  function handleExport() {
    exportData(undefined, {
      onError: () =>
        Alert.alert(t("common.error"), t("settings.data.exportError")),
    });
  }

  /**
   * The restore prompt. It has to settle even when no button is pressed: on
   * Android an Alert is dismissible with the back gesture, and a confirm that
   * never resolves would pin the import mutation pending and leave the whole
   * Data section disabled until the app restarts.
   */
  const confirmImport = useCallback(
    ({
      conventionCount,
      eventCount,
    }: {
      conventionCount: number;
      eventCount: number;
    }) =>
      new Promise<boolean>((resolve) => {
        Alert.alert(
          t("settings.dataImport.confirmTitle"),
          t("settings.dataImport.confirmMessage", {
            conventions: conventionCount,
            events: eventCount,
          }),
          [
            {
              text: t("common.cancel"),
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: t("settings.dataImport.confirmAction"),
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      }),
    [t],
  );

  const handleImportOutcome = useCallback(
    (outcome: ImportOutcome) => {
      const message = importOutcomeMessage(outcome, t);
      if (message) Alert.alert(message.title, message.body);
    },
    [t],
  );

  const { importData, isLoading: isImporting } = useImportData({
    confirm: confirmImport,
    onOutcome: handleImportOutcome,
  });

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section title={t("settings.app.title")}>
          <ListItem
            leading={<LeadingIcon name={APPEARANCE} />}
            supportingText={t(`settings.appearance.${appearance}`)}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/appearance")}
          >
            {t("settings.app.theme")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon name={LANGUAGE} />}
            supportingText={t(
              `settings.languages.${i18n.language as SupportedLanguage}`,
              { defaultValue: "English" },
            )}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/language")}
          >
            {t("settings.app.language")}
          </ListItem>
          <NativeSwitch
            testID="haptics-switch"
            label={t("settings.app.haptics")}
            value={haptics}
            onValueChange={handleHapticsChange}
          />
        </FieldGroup.Section>

        <FieldGroup.Section
          title={t("settings.data.title")}
          disabled={isExporting || isImporting}
        >
          <ListItem
            leading={<LeadingIcon name={EXPORT} />}
            supportingText={
              isExporting
                ? t("settings.data.exporting")
                : t("settings.data.exportDescription")
            }
            onPress={isExporting ? undefined : handleExport}
          >
            {t("settings.data.exportData")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon name={IMPORT} />}
            supportingText={
              isImporting
                ? t("settings.data.importing")
                : t("settings.data.importDescription")
            }
            onPress={isImporting ? undefined : () => importData()}
          >
            {t("settings.data.importData")}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.about.title")}>
          <ListItem
            leading={<LeadingIcon name={ABOUT} />}
            supportingText={versionLabel}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/about")}
          >
            {t("settings.legal.about")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon name={PRIVACY} />}
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync("https://conpaws.com/privacy")
            }
          >
            {t("settings.legal.privacyPolicy")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon name={TERMS} />}
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
              leading={<LeadingIcon name={DEBUG} />}
              supportingText="Replay onboarding safely"
              trailing={<NavigationIndicator />}
              onPress={() => router.push("/settings/debug")}
            >
              Debug Tools
            </ListItem>
            <ListItem
              leading={<LeadingIcon name={UI_SYSTEM} />}
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
