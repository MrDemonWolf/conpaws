import * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_CHANNEL_ID = "event-reminders";

export type PermissionStatus = "granted" | "denied" | "undetermined";

export function setupNotificationHandler(): void {
  ExpoNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (Platform.OS === "android") {
    await ExpoNotifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "Event reminders",
      importance: ExpoNotifications.AndroidImportance.HIGH,
    });
  }

  const { status: existing } = await ExpoNotifications.getPermissionsAsync();
  if (existing === "granted") return "granted";

  const { status } = await ExpoNotifications.requestPermissionsAsync();
  return status as PermissionStatus;
}

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  const { status } = await ExpoNotifications.getPermissionsAsync();
  return status as PermissionStatus;
}

interface EventForReminder {
  id: string;
  title: string;
  startTime: string; // ISO string
  room: string | null;
}

export async function scheduleEventReminder(
  event: EventForReminder,
  minutesBefore: number,
): Promise<string | null> {
  const notificationId = `reminder-${event.id}`;

  // Always clear a stale request before an early return or replacement.
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // May not exist.
  }

  if ((await requestNotificationPermission()) !== "granted") return null;

  const startMs = new Date(event.startTime).getTime();
  const triggerMs = startMs - minutesBefore * 60 * 1000;

  if (triggerMs <= Date.now()) {
    return null; // In the past
  }

  const body = event.room
    ? `Starting in ${minutesBefore} min · ${event.room}`
    : `Starting in ${minutesBefore} min`;

  await ExpoNotifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: event.title,
      body,
      sound: true,
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerMs),
      channelId: REMINDER_CHANNEL_ID,
    },
  });

  return notificationId;
}

export async function cancelEventReminder(eventId: string): Promise<boolean> {
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(
      `reminder-${eventId}`,
    );
    return true;
  } catch {
    return false;
  }
}

export async function cancelConventionReminders(
  eventIds: string[],
): Promise<void> {
  await Promise.all(eventIds.map((id) => cancelEventReminder(id)));
}
