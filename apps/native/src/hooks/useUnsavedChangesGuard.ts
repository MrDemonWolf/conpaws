import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import type { TFunction } from "i18next";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

/**
 * Asks before user input is thrown away, then runs `proceed` if they confirm.
 * Exported for surfaces that are not routes (modals), which cannot use the hook.
 */
export function confirmDiscardChanges(t: TFunction, proceed: () => void) {
  Alert.alert(
    t("common.discardChangesTitle"),
    t("common.discardChangesMessage"),
    [
      { text: t("common.keepEditing"), style: "cancel" },
      { text: t("common.discard"), style: "destructive", onPress: proceed },
    ],
  );
}

interface UnsavedChangesGuardOptions {
  /** Whether the form currently holds user input that would be lost. */
  isDirty: boolean;
  /** Called once the user has confirmed they want to abandon their input. */
  onDiscard: () => void;
}

/**
 * Confirms before user input is thrown away.
 *
 * Covers both routes out of a form: the system back gesture, hardware back key
 * and sheet swipe-down (via `usePreventRemove`), and an explicit Cancel button
 * (via the returned `confirmDiscard`).
 */
export function useUnsavedChangesGuard({
  isDirty,
  onDiscard,
}: UnsavedChangesGuardOptions) {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const confirm = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      confirmDiscardChanges(t, proceed);
    },
    [isDirty, t],
  );

  usePreventRemove(isDirty, ({ data }) => {
    confirm(() => navigation.dispatch(data.action));
  });

  return {
    confirmDiscard: useCallback(() => confirm(onDiscard), [confirm, onDiscard]),
  };
}
