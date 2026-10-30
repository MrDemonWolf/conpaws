import { usePreventRemove } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useState } from "react";
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
  const [allowRemoval, setAllowRemoval] = useState(false);

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

  const disablePrevention = usePreventRemove(
    isDirty && !allowRemoval,
    ({ repeat }) => {
      confirm(() => {
        setAllowRemoval(true);
        repeat();
      });
    },
  );

  return {
    confirmDiscard: useCallback(
      () =>
        confirm(() => {
          setAllowRemoval(true);
          disablePrevention();
          onDiscard();
        }),
      [confirm, disablePrevention, onDiscard],
    ),
  };
}
