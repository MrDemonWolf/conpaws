import ArrowOutwardIcon from "@expo/material-symbols/arrow_outward.xml";
import {
  FieldGroup,
  Host,
  Icon,
  Switch as NativeSwitch,
  Picker,
} from "@expo/ui";
import Constants from "expo-constants";
import { type Href, router, useFocusEffect } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Linking } from "react-native";
import { SettingsLeadingIcon } from "@/components/SettingsLeadingIcon";
// See components/ui/FieldRow.android.tsx — one Material surface per row.
import { FieldRow as ListItem } from "@/components/ui/FieldRow";
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
import { openExternal } from "@/lib/open-external";
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

  // One place that catches the two rejections these links actually produce: a
  // second tap while a browser is already up, and a `mailto:` on a device with
  // no mail account. Both used to be unhandled and silent.
  function openLink(url: string) {
    void openExternal(url, {
      errorTitle: t("common.error"),
      errorMessage: t("common.openLinkError"),
    });
  }

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
        setDefaultLead(parsed);
        void setDefaultReminderMinutes(parsed);
      }}
      appearance="menu"
    >
      <Picker.Item label={t("settings.notifications.noDefault")} value="" />
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
  );

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
            leading={<SettingsLeadingIcon name="theme" />}
            supportingText={t(`settings.appearance.${appearance}`)}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/appearance")}
          >
            {t("settings.app.theme")}
          </ListItem>
          <ListItem
            leading={<SettingsLeadingIcon name="language" />}
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
          <NativeSwitch
            testID="schedule-auto-check-switch"
            label={t("settings.app.scheduleAutoCheck")}
            value={scheduleAutoCheck}
            onValueChange={handleScheduleAutoCheckChange}
          />
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.notifications.title")}>
          <ListItem
            leading={<SettingsLeadingIcon name="notifications" />}
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
          {/* The same choice, offered differently per platform. On iOS the
              SwiftUI menu is compact and belongs in the trailing slot. On
              Android @expo/ui renders a Material 3 ExposedDropdownMenuBox whose
              anchor is a bare TextField: unlabelled, sized to its own content
              rather than the row, and trailing an underline past its own edge.
              The universal Picker takes no `style` and no `label`, so Android
              pushes a list of rows instead -- the same shape as Theme and
              Language directly above, and how Material selects from a list
              anyway. */}
          <ListItem
            supportingText={
              process.env.EXPO_OS === "ios"
                ? t("settings.notifications.defaultLeadDescription")
                : reminderDefaultLabel(defaultLead, t)
            }
            trailing={
              process.env.EXPO_OS === "ios" ? (
                defaultLeadPicker
              ) : (
                <NavigationIndicator />
              )
            }
            onPress={
              process.env.EXPO_OS === "ios"
                ? undefined
                : () => router.push("/settings/reminder-default" as Href)
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
            leading={<SettingsLeadingIcon name="export" />}
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
            leading={<SettingsLeadingIcon name="import" />}
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
            leading={<SettingsLeadingIcon name="about" />}
            supportingText={versionLabel}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/about")}
          >
            {t("settings.legal.about")}
          </ListItem>
          <ListItem
            leading={<SettingsLeadingIcon name="help" />}
            supportingText={t("settings.help.gettingStartedDescription")}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/getting-started" as Href)}
          >
            {t("settings.help.gettingStarted")}
          </ListItem>
          <ListItem
            leading={<SettingsLeadingIcon name="privacy" />}
            trailing={<ExternalIndicator />}
            onPress={() => openLink("https://conpaws.com/privacy")}
          >
            {t("settings.legal.privacyPolicy")}
          </ListItem>
          <ListItem
            leading={<SettingsLeadingIcon name="terms" />}
            trailing={<ExternalIndicator />}
            onPress={() => openLink("https://conpaws.com/terms")}
          >
            {t("settings.legal.termsOfService")}
          </ListItem>
        </FieldGroup.Section>

        {showDeveloperTools ? (
          <FieldGroup.Section title="Developer">
            <ListItem
              leading={<SettingsLeadingIcon name="debug" />}
              supportingText="Replay onboarding safely"
              trailing={<NavigationIndicator />}
              onPress={() => router.push("/settings/debug")}
            >
              Debug Tools
            </ListItem>
            <ListItem
              leading={<SettingsLeadingIcon name="debug" />}
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
              leading={<SettingsLeadingIcon name="theme" />}
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
