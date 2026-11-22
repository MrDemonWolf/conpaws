import { FieldGroup, Host, Picker } from "@expo/ui";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, useWindowDimensions } from "react-native";
import { ContentScrollLink } from "@/components/ContentScrollLink";
import { settingsFooter } from "@/components/SettingsFooter";
import { SettingsLeadingIcon } from "@/components/SettingsLeadingIcon";
import { settingsLinkRow, settingsSwitchRow } from "@/components/SettingsRows";
import { SETTINGS_STACKED_FONT_SCALE } from "@/components/SettingsRows.types";
import { FieldRow } from "@/components/ui/FieldRow";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useOpenLink } from "@/hooks/useOpenLink";
import { useReadableFieldGroup } from "@/hooks/useReadableFieldGroup";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { useVersionLabel } from "@/hooks/useVersionLabel";
import {
  getAppearancePreference,
  subscribeAppearancePreference,
} from "@/lib/appearance-storage";
import { importOutcomeMessage } from "@/lib/data-import-messages";
import {
  developerDiagnosticsEnabled,
  developerToolsEnabled,
} from "@/lib/developer-tools";
import {
  getTimeFormatPreference,
  subscribeTimeFormat,
} from "@/lib/device-clock";
import { saveHapticsPreference } from "@/lib/haptics-storage";
import i18n, { type SupportedLanguage } from "@/lib/i18n";
import { reminderDefaultLabel } from "@/lib/reminder-default-label";
import {
  getCachedDefaultReminderMinutes,
  getDefaultReminderMinutes,
  REMINDER_DEFAULT_OPTIONS,
  setDefaultReminderMinutes,
} from "@/lib/reminder-default-storage";
import { resetScheduleHint } from "@/lib/schedule-hint-storage";
import {
  getCachedScheduleAutoCheck,
  setScheduleAutoCheck as persistScheduleAutoCheck,
} from "@/lib/schedule-refresh-storage";
import { useExportData } from "@/services/data-export";
import { type ImportOutcome, useImportData } from "@/services/data-import";
import { getHapticsEnabled } from "@/services/haptics";
import { requestNotificationPermission } from "@/services/notifications";

export default function SettingsScreen() {
  const { fontScale } = useWindowDimensions();
  const { t } = useTranslation();

  const openLink = useOpenLink();

  const { exportData, isLoading: isExporting } = useExportData();
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();
  const readableGroup = useReadableFieldGroup();
  const versionLabel = useVersionLabel();
  const appearance = useSyncExternalStore(
    subscribeAppearancePreference,
    getAppearancePreference,
    getAppearancePreference,
  );

  const appVariant = Constants.expoConfig?.extra?.appVariant;
  const showPreviewTesting = developerToolsEnabled(__DEV__, appVariant);
  const showDeveloperTools = developerDiagnosticsEnabled(__DEV__, appVariant);
  const timeFormat = useSyncExternalStore(
    subscribeTimeFormat,
    getTimeFormatPreference,
    getTimeFormatPreference,
  );

  const [haptics, setHaptics] = useState(getHapticsEnabled);
  // Seeded from the cache the launch bootstrap primed, so the switch is right
  // on the first frame rather than flipping under the reader.
  const [scheduleAutoCheck, setScheduleAutoCheck] = useState(
    getCachedScheduleAutoCheck,
  );

  function handleScheduleAutoCheckChange(next: boolean) {
    // Optimistic so the switch tracks the finger; reverted if the write fails,
    // the same way haptics below does. Without the revert the switch showed a
    // setting that was gone by the next launch.
    setScheduleAutoCheck(next);
    void persistScheduleAutoCheck(next).catch(() => {
      setScheduleAutoCheck(!next);
      Alert.alert(t("common.error"), t("settings.app.scheduleAutoCheckError"));
    });
  }

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
      onError: (error) =>
        Alert.alert(
          t("common.error"),
          error.message || t("settings.data.exportError"),
        ),
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

  const detectedPermission = useNotificationPermission();
  const [notificationPermission, setNotificationPermission] =
    useState(detectedPermission);
  const [requestingPermission, setRequestingPermission] = useState(false);
  useEffect(
    () => setNotificationPermission(detectedPermission),
    [detectedPermission],
  );

  async function handlePermission() {
    if (requestingPermission || notificationPermission === null) return;
    setRequestingPermission(true);
    try {
      if (notificationPermission === "undetermined") {
        setNotificationPermission(await requestNotificationPermission());
      } else {
        await Linking.openSettings();
      }
    } catch {
      Alert.alert(t("common.error"), t("settings.notifications.changeError"));
    } finally {
      setRequestingPermission(false);
    }
  }
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultLead, setDefaultLead] = useState<number | null>(
    getCachedDefaultReminderMinutes,
  );
  // On focus, not just on mount: Android sets this on a pushed screen, so the
  // row would otherwise keep showing the value from before the trip and only
  // catch up on relaunch. iOS changes it in place and re-reads harmlessly.
  useFocusEffect(
    useCallback(() => {
      void getDefaultReminderMinutes().then(setDefaultLead);
    }, []),
  );

  const defaultLeadPicker = (
    <Picker
      selectedValue={String(defaultLead ?? "")}
      onValueChange={(value) => {
        const parsed = value === "" ? null : Number(value);
        if (savingDefault) return;
        const previous = defaultLead;
        setSavingDefault(true);
        setDefaultLead(parsed);
        void setDefaultReminderMinutes(parsed)
          .catch(() => {
            setDefaultLead(previous);
            Alert.alert(
              t("common.error"),
              t("settings.notifications.defaultLeadError"),
            );
          })
          .finally(() => setSavingDefault(false));
      }}
      appearance="menu"
    >
      <Picker.Item label={reminderDefaultLabel(null, t)} value="" />
      {REMINDER_DEFAULT_OPTIONS.map((minutes) => (
        <Picker.Item
          key={String(minutes)}
          label={reminderDefaultLabel(minutes, t)}
          value={String(minutes)}
        />
      ))}
    </Picker>
  );

  const isIOS = process.env.EXPO_OS === "ios";
  // iOS keeps the compact SwiftUI menu in the row until Dynamic Type makes it
  // too wide; Android and large text push the reminder-default list instead
  // (see reminder-default.tsx for why Android never uses the inline menu).
  const inlineReminderMenu = isIOS && fontScale < SETTINGS_STACKED_FONT_SCALE;
  const notificationStatus =
    notificationPermission === "granted"
      ? t("settings.notifications.enabled")
      : notificationPermission === "denied"
        ? t("settings.notifications.disabled")
        : t("settings.notifications.notRequested");

  return (
    <ContentScrollLink style={{ flex: 1 }}>
      <Host
        colorScheme={resolvedColorScheme}
        seedColor={colors.primary}
        style={{ flex: 1 }}
        useViewportSizeMeasurement
      >
        <FieldGroup {...readableGroup}>
          <FieldGroup.Section title={t("settings.sections.appearance")}>
            {settingsLinkRow({
              icon: "theme",
              title: t("settings.app.theme"),
              value: t(`settings.appearance.${appearance}`),
              onPress: () => router.push("/settings/appearance"),
            })}
            {settingsSwitchRow({
              testID: "haptics-switch",
              icon: "haptics",
              title: t("settings.app.haptics"),
              value: haptics,
              onValueChange: handleHapticsChange,
            })}
          </FieldGroup.Section>

          <FieldGroup.Section title={t("settings.sections.languageRegion")}>
            {settingsLinkRow({
              icon: "language",
              title: t("settings.app.language"),
              value: t(
                `settings.languages.${i18n.language as SupportedLanguage}`,
                { defaultValue: "English" },
              ),
              onPress: () => router.push("/settings/language"),
            })}
            {settingsLinkRow({
              icon: "time",
              title: t("settings.timeFormat.title"),
              value: t(
                `settings.timeFormat.short.${timeFormat === "12" ? "hour12" : timeFormat === "24" ? "hour24" : "system"}`,
              ),
              onPress: () => router.push("/settings/time-format"),
            })}
          </FieldGroup.Section>

          <FieldGroup.Section
            title={t("settings.sections.reminders")}
            disabled={requestingPermission || savingDefault}
          >
            {settingsLinkRow({
              icon: "notifications",
              kind: "external",
              title: t(
                notificationPermission === "undetermined"
                  ? "settings.notifications.enable"
                  : "settings.notifications.permission",
              ),
              description: notificationStatus,
              busy: notificationPermission === null || requestingPermission,
              onPress: () => void handlePermission(),
            })}
            {inlineReminderMenu ? (
              <FieldRow
                leading={<SettingsLeadingIcon name="reminder" />}
                trailing={defaultLeadPicker}
              >
                {t("settings.notifications.defaultLead")}
              </FieldRow>
            ) : (
              settingsLinkRow({
                icon: "reminder",
                title: t("settings.notifications.defaultLead"),
                value: reminderDefaultLabel(defaultLead, t),
                onPress: () => router.push("/settings/reminder-default"),
              })
            )}
            {settingsFooter(t("settings.notifications.defaultLeadDescription"))}
          </FieldGroup.Section>

          <FieldGroup.Section title={t("settings.sections.scheduleUpdates")}>
            {settingsSwitchRow({
              testID: "schedule-auto-check-switch",
              icon: "updates",
              title: t("settings.app.scheduleAutoCheck"),
              value: scheduleAutoCheck,
              onValueChange: handleScheduleAutoCheckChange,
            })}
            {settingsFooter(t("settings.footers.scheduleUpdates"))}
          </FieldGroup.Section>

          <FieldGroup.Section
            title={t("settings.sections.backup")}
            disabled={isExporting || isImporting}
          >
            {settingsLinkRow({
              icon: "export",
              kind: "action",
              title: t("settings.data.exportData"),
              description: isExporting
                ? t("settings.data.exporting")
                : t("settings.data.exportDescription"),
              busy: isExporting,
              onPress: handleExport,
            })}
            {settingsLinkRow({
              icon: "import",
              kind: "action",
              title: t("settings.data.importData"),
              description: isImporting
                ? t("settings.data.importing")
                : t("settings.data.importDescription"),
              busy: isImporting,
              onPress: () => importData(),
            })}
            {settingsFooter(t("settings.footers.backup"))}
          </FieldGroup.Section>

          <FieldGroup.Section title={t("settings.sections.helpAbout")}>
            {settingsLinkRow({
              icon: "help",
              title: t("settings.help.gettingStarted"),
              description: t("settings.help.gettingStartedDescription"),
              onPress: () => router.push("/settings/getting-started"),
            })}
            {settingsLinkRow({
              icon: "about",
              title: t("settings.legal.about"),
              description: versionLabel,
              onPress: () => router.push("/settings/about"),
            })}
            {settingsLinkRow({
              icon: "privacy",
              kind: "external",
              title: t("settings.legal.privacyPolicy"),
              onPress: () => openLink("https://conpaws.com/privacy"),
            })}
            {settingsLinkRow({
              icon: "terms",
              kind: "external",
              title: t("settings.legal.termsOfService"),
              onPress: () => openLink("https://conpaws.com/terms"),
            })}
          </FieldGroup.Section>

          {showPreviewTesting ? (
            <FieldGroup.Section title={t("settings.preview.title")}>
              {settingsLinkRow({
                icon: "preview",
                title: t("settings.preview.title"),
                description: t("settings.preview.description"),
                onPress: () => router.push("/settings/preview"),
              })}
            </FieldGroup.Section>
          ) : null}

          {showDeveloperTools ? (
            <FieldGroup.Section title="Developer">
              {settingsLinkRow({
                icon: "debug",
                title: "Debug Tools",
                description: "Replay onboarding safely",
                onPress: () => router.push("/settings/debug"),
              })}
              {settingsLinkRow({
                icon: "debug",
                kind: "action",
                title: "Reset Hints",
                description: "Show the schedule hint card again",
                onPress: () => {
                  void resetScheduleHint().then(() =>
                    Alert.alert("Hints reset", "The hint will show again."),
                  );
                },
              })}
              {settingsLinkRow({
                icon: "theme",
                title: "UI System",
                description: "Preview app controls and states",
                onPress: () => router.push("/settings/ui-system"),
              })}
            </FieldGroup.Section>
          ) : null}
        </FieldGroup>
      </Host>
    </ContentScrollLink>
  );
}
