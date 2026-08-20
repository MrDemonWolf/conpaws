import * as ExpoNotifications from "expo-notifications";
import i18n from "i18next";
import { Platform } from "react-native";
import * as eventsRepo from "@/db/repositories/events";

const REMINDER_CHANNEL_ID = "event-reminders";
const REMINDER_IDENTIFIER_PREFIX = "reminder-";
const TEST_NOTIFICATION_IDENTIFIER_PREFIX = "developer-test-";

export type PermissionStatus = "granted" | "denied" | "undetermined";

async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await ExpoNotifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: i18n.isInitialized
      ? i18n.t("reminders.channelName")
      : "Event reminders",
    importance: ExpoNotifications.AndroidImportance.HIGH,
  });
}

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
  await ensureReminderChannel();

  const { status: existing } = await ExpoNotifications.getPermissionsAsync();
  if (existing === "granted") return "granted";

  const { status } = await ExpoNotifications.requestPermissionsAsync();
  return status as PermissionStatus;
}

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  const { status } = await ExpoNotifications.getPermissionsAsync();
  return status as PermissionStatus;
}

export async function scheduleTestNotification(): Promise<string | null> {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  const identifier = `${TEST_NOTIFICATION_IDENTIFIER_PREFIX}${Date.now()}`;
  await ExpoNotifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: "ConPaws test notification",
      body: "Notifications are working. Your convention reminders can reach you.",
      sound: true,
      data: { kind: "developer-test" },
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: REMINDER_CHANNEL_ID,
    },
  });

  return identifier;
}

export async function cancelTestNotifications(): Promise<number> {
  const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
  const identifiers: string[] = [];
  for (const request of scheduled) {
    if (request.identifier.startsWith(TEST_NOTIFICATION_IDENTIFIER_PREFIX)) {
      identifiers.push(request.identifier);
    }
  }

  await Promise.all(
    identifiers.map((identifier) =>
      ExpoNotifications.cancelScheduledNotificationAsync(identifier),
    ),
  );
  return identifiers.length;
}

interface EventForReminder {
  id: string;
  title: string;
  startTime: string; // ISO string
  room: string | null;
}

interface ScheduleReminderOptions {
  requestPermission?: boolean;
  notificationContent?: {
    title: string;
    body: string;
  };
}

export async function scheduleEventReminder(
  event: EventForReminder,
  minutesBefore: number,
  options: ScheduleReminderOptions = {},
): Promise<string | null> {
  const notificationId = `${REMINDER_IDENTIFIER_PREFIX}${event.id}`;

  // Always clear a stale request before an early return or replacement.
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // May not exist.
  }

  const permission =
    options.requestPermission === false
      ? await getNotificationPermissionStatus()
      : await requestNotificationPermission();
  if (permission !== "granted") return null;
  await ensureReminderChannel();

  const startMs = new Date(event.startTime).getTime();
  const triggerMs = startMs - minutesBefore * 60 * 1000;

  if (triggerMs <= Date.now()) {
    return null; // In the past
  }

  const notificationContent =
    options.notificationContent ??
    (i18n.isInitialized
      ? {
          title: i18n.t("reminders.notificationTitle", {
            event: event.title,
          }),
          body: i18n.t(
            event.room
              ? "reminders.notificationBodyWithRoom"
              : "reminders.notificationBody",
            { minutes: minutesBefore, room: event.room },
          ),
        }
      : {
          title: `Time to leave for ${event.title}`,
          body: event.room
            ? `Starts in ${minutesBefore} min · ${event.room}`
            : `Starts in ${minutesBefore} min`,
        });

  await ExpoNotifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      ...notificationContent,
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
      `${REMINDER_IDENTIFIER_PREFIX}${eventId}`,
    );
    return true;
  } catch {
    return false;
  }
}

export async function cancelConventionReminders(
  eventIds: string[],
): Promise<boolean> {
  const results = await Promise.all(
    eventIds.map((id) => cancelEventReminder(id)),
  );
  return results.every(Boolean);
}

export interface ReminderReconciliationResult {
  rescheduled: number;
  cleared: number;
  staleCancelled: number;
}

export async function reconcileEventReminders(): Promise<ReminderReconciliationResult> {
  const events = await eventsRepo.getAllWithReminders();
  const eventIds = new Set(events.map((event) => event.id));
  let staleCancelled = 0;

  try {
    const scheduled =
      await ExpoNotifications.getAllScheduledNotificationsAsync();
    const staleIdentifiers: string[] = [];
    for (const request of scheduled) {
      const { identifier } = request;
      if (
        identifier.startsWith(REMINDER_IDENTIFIER_PREFIX) &&
        !eventIds.has(identifier.slice(REMINDER_IDENTIFIER_PREFIX.length))
      ) {
        staleIdentifiers.push(identifier);
      }
    }
    await Promise.all(
      staleIdentifiers.map((identifier) =>
        ExpoNotifications.cancelScheduledNotificationAsync(identifier),
      ),
    );
    staleCancelled = staleIdentifiers.length;
  } catch {
    // A later launch retries cleanup if the OS notification store is unavailable.
  }

  const permission = await getNotificationPermissionStatus();
  let rescheduled = 0;
  let cleared = 0;

  for (const event of events) {
    const minutes = event.reminderMinutes;
    if (minutes === null) continue;
    const triggerMs = new Date(event.startTime).getTime() - minutes * 60 * 1000;

    if (permission !== "granted" || triggerMs <= Date.now()) {
      await cancelEventReminder(event.id);
      await eventsRepo.update(event.id, { reminderMinutes: null });
      cleared++;
      continue;
    }

    try {
      const notificationId = await scheduleEventReminder(
        {
          id: event.id,
          title: event.title,
          startTime: event.startTime,
          room: event.room ?? event.location,
        },
        minutes,
        { requestPermission: false },
      );
      if (notificationId) {
        rescheduled++;
        continue;
      }
    } catch {
      // Clear the saved state below; a failed OS request must not remain enabled.
    }

    await eventsRepo.update(event.id, { reminderMinutes: null });
    cleared++;
  }

  return { rescheduled, cleared, staleCancelled };
}
