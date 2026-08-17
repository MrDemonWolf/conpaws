import * as ExpoNotifications from "expo-notifications";

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
  const startMs = new Date(event.startTime).getTime();
  const triggerMs = startMs - minutesBefore * 60 * 1000;

  if (triggerMs <= Date.now()) {
    return null; // In the past
  }

  const notificationId = `reminder-${event.id}`;

  // Cancel any existing reminder for this event
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // May not exist
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
    },
  });

  return notificationId;
}

export async function cancelEventReminder(eventId: string): Promise<void> {
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(
      `reminder-${eventId}`,
    );
  } catch {
    // Ignore
  }
}

export async function cancelConventionReminders(
  eventIds: string[],
): Promise<void> {
  await Promise.all(eventIds.map((id) => cancelEventReminder(id)));
}
