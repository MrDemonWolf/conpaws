import { Alert, Linking } from "react-native";

/**
 * The pre-prompt shown before the FIRST OS notification dialog, so the system
 * sheet arrives with context instead of out of nowhere. Shared by the reminder
 * picker and the drop-in visit form. Resolves true when the user wants to
 * continue to the OS dialog.
 */
export function confirmNotificationPriming(
  t: (key: string) => string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t("reminders.priming.title"), t("reminders.priming.message"), [
      {
        text: t("reminders.priming.notNow"),
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: t("reminders.priming.continue"),
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * The permission-denied alert with an Open Settings button, for both
 * notification and Live Activity denials.
 */
export function showOpenSettingsAlert(
  title: string,
  message: string,
  t: (key: string) => string,
): void {
  Alert.alert(title, message, [
    { text: t("common.cancel"), style: "cancel" },
    {
      text: t("reminders.openSettings"),
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}
