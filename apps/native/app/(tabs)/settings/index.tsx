import ArrowOutwardIcon from "@expo/material-symbols/arrow_outward.xml";
import {
  FieldGroup,
  Host,
  Icon,
  ListItem,
  Switch as NativeSwitch,
  Picker,
} from "@expo/ui";
import Constants from "expo-constants";
import { type Href, router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import * as WebBrowser from "expo-web-browser";
import {
  Bell,
  Bug,
  CircleHelp,
  Download,
  FileText,
  Globe,
  Hand,
  Info,
  type LucideIcon,
  Palette,
  Share,
} from "lucide-react-native";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Linking } from "react-native";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
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
import {
  getCachedDefaultReminderMinutes,
  getDefaultReminderMinutes,
  REMINDER_DEFAULT_OPTIONS,
  setDefaultReminderMinutes,
} from "@/lib/reminder-default-storage";
import { resetScheduleHint } from "@/lib/schedule-hint-storage";
import { themeTokens } from "@/lib/theme-tokens";
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

/**
 * Plain leading glyph (lucide, JS-rendered): @expo/ui's native Icon collapses
 * inside RN wrapper views, and colored icon tiles were tried and rejected —
 * bare monochrome glyphs match the rest of the app's chrome.
 */
function LeadingIcon({ icon: IconComponent }: { icon: LucideIcon }) {
  const scheme = useResolvedColorScheme();
  return <IconComponent size={21} color={themeTokens[scheme].foreground} />;
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

  const notificationPermission = useNotificationPermission();
  const [defaultLead, setDefaultLead] = useState<number | null>(
    getCachedDefaultReminderMinutes,
  );
  useEffect(() => {
    void getDefaultReminderMinutes().then(setDefaultLead);
  }, []);

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
            leading={<LeadingIcon icon={Palette} />}
            supportingText={t(`settings.appearance.${appearance}`)}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/appearance")}
          >
            {t("settings.app.theme")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon icon={Globe} />}
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

        <FieldGroup.Section title={t("settings.notifications.title")}>
          <ListItem
            leading={<LeadingIcon icon={Bell} />}
            supportingText={
              notificationPermission === "granted"
                ? t("settings.notifications.enabled")
                : notificationPermission === "denied"
                  ? t("settings.notifications.disabled")
                  : t("settings.notifications.notRequested")
            }
            trailing={<ExternalIndicator />}
            onPress={() => {
              void Linking.openSettings();
            }}
          >
            {t("settings.notifications.permission")}
          </ListItem>
          <ListItem
            supportingText={t("settings.notifications.defaultLeadDescription")}
            trailing={
              <Picker
                selectedValue={String(defaultLead ?? "")}
                onValueChange={(value) => {
                  const parsed = value === "" ? null : Number(value);
                  setDefaultLead(parsed);
                  void setDefaultReminderMinutes(parsed);
                }}
                appearance="menu"
              >
                <Picker.Item
                  label={t("settings.notifications.noDefault")}
                  value=""
                />
                {REMINDER_DEFAULT_OPTIONS.map((minutes) => (
                  <Picker.Item
                    key={String(minutes)}
                    label={
                      minutes === 0
                        ? t("reminders.atTime")
                        : minutes === 60
                          ? t("reminders.hourBefore")
                          : t("reminders.minutesBefore", { minutes })
                    }
                    value={String(minutes)}
                  />
                ))}
              </Picker>
            }
          >
            {t("settings.notifications.defaultLead")}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section
          title={t("settings.data.title")}
          disabled={isExporting || isImporting}
        >
          <ListItem
            leading={<LeadingIcon icon={Share} />}
            supportingText={
              isExporting
                ? t("settings.data.exporting")
                : t("settings.data.exportDescription")
            }
            trailing={
              isExporting ? <ActivityIndicator size="small" /> : undefined
            }
            onPress={isExporting ? undefined : handleExport}
          >
            {t("settings.data.exportData")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon icon={Download} />}
            supportingText={
              isImporting
                ? t("settings.data.importing")
                : t("settings.data.importDescription")
            }
            trailing={
              isImporting ? <ActivityIndicator size="small" /> : undefined
            }
            onPress={isImporting ? undefined : () => importData()}
          >
            {t("settings.data.importData")}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.about.title")}>
          <ListItem
            leading={<LeadingIcon icon={Info} />}
            supportingText={versionLabel}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/about")}
          >
            {t("settings.legal.about")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon icon={CircleHelp} />}
            supportingText={t("settings.help.gettingStartedDescription")}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/getting-started" as Href)}
          >
            {t("settings.help.gettingStarted")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon icon={Hand} />}
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync("https://conpaws.com/privacy")
            }
          >
            {t("settings.legal.privacyPolicy")}
          </ListItem>
          <ListItem
            leading={<LeadingIcon icon={FileText} />}
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
              leading={<LeadingIcon icon={Bug} />}
              supportingText="Replay onboarding safely"
              trailing={<NavigationIndicator />}
              onPress={() => router.push("/settings/debug")}
            >
              Debug Tools
            </ListItem>
            <ListItem
              leading={<LeadingIcon icon={Bug} />}
              supportingText="Show the schedule hint card again"
              onPress={() => {
                void resetScheduleHint().then(() =>
                  Alert.alert("Hints reset", "The hint will show again."),
                );
              }}
            >
              Reset Hints
            </ListItem>
            <ListItem
              leading={<LeadingIcon icon={Palette} />}
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
