import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import {
  cancelEventReminder,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleEventReminder,
} from "@/services/notifications";

const NOTIFICATIONS_REQUESTED_KEY = "hasRequestedNotifications";

export function useEventReminder(event: ConventionEvent) {
  const [showPrePrompt, setShowPrePrompt] = useState(false);
  const [pendingMinutes, setPendingMinutes] = useState<number | null>(null);

  async function setReminder(minutes: number): Promise<{ denied?: boolean }> {
    if (minutes === 0) {
      await clearReminder();
      return {};
    }

    const hasRequested = await AsyncStorage.getItem(
      NOTIFICATIONS_REQUESTED_KEY,
    );

    if (!hasRequested) {
      // Show custom pre-prompt
      setPendingMinutes(minutes);
      setShowPrePrompt(true);
      return {};
    }

    return _doSetReminder(minutes);
  }

  async function _doSetReminder(
    minutes: number,
  ): Promise<{ denied?: boolean }> {
    const permission = await getNotificationPermissionStatus();

    if (permission === "undetermined") {
      await AsyncStorage.setItem(NOTIFICATIONS_REQUESTED_KEY, "true");
      const result = await requestNotificationPermission();
      if (result !== "granted") {
        return { denied: true };
      }
    } else if (permission === "denied") {
      return { denied: true };
    }

    // Cancel existing first
    await cancelEventReminder(event.id);

    // Schedule new
    await scheduleEventReminder(
      {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        room: event.room,
      },
      minutes,
    );

    // Persist to DB
    await eventsRepo.update(event.id, { reminderMinutes: minutes });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    return {};
  }

  async function handlePrePromptEnable() {
    setShowPrePrompt(false);
    await AsyncStorage.setItem(NOTIFICATIONS_REQUESTED_KEY, "true");
    if (pendingMinutes !== null) {
      await _doSetReminder(pendingMinutes);
      setPendingMinutes(null);
    }
  }

  function handlePrePromptDismiss() {
    setShowPrePrompt(false);
    setPendingMinutes(null);
  }

  async function clearReminder(): Promise<void> {
    await cancelEventReminder(event.id);
    await eventsRepo.update(event.id, { reminderMinutes: null });
  }

  return {
    setReminder,
    clearReminder,
    hasReminder: event.reminderMinutes !== null,
    reminderMinutes: event.reminderMinutes,
    showPrePrompt,
    handlePrePromptEnable,
    handlePrePromptDismiss,
  };
}
