import * as ExpoNotifications from "expo-notifications";
import i18n from "i18next";
import { Platform } from "react-native";
import * as eventsRepo from "@/db/repositories/events";

const REMINDER_CHANNEL_ID = "event-reminders";
const REMINDER_IDENTIFIER_PREFIX = "reminder-";
const TEST_NOTIFICATION_IDENTIFIER_PREFIX = "developer-test-";

// iOS keeps only the 64 soonest pending local notifications and silently
// discards the rest, so leave headroom for the developer test notification.
const MAX_PENDING_REMINDERS = 60;

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
  conventionId?: string | null;
}

interface ReminderNotificationContent {
  title: string;
  body: string;
}

interface ScheduleReminderOptions {
  requestPermission?: boolean;
  notificationContent?: ReminderNotificationContent;
}

function reminderNotificationContent(
  event: EventForReminder,
  minutesBefore: number,
  override?: ReminderNotificationContent,
): ReminderNotificationContent {
  if (override) return override;
  if (!i18n.isInitialized) {
    return {
      title: `Time to leave for ${event.title}`,
      body: event.room
        ? `Starts in ${minutesBefore} min · ${event.room}`
        : `Starts in ${minutesBefore} min`,
    };
  }
  return {
    title: i18n.t("reminders.notificationTitle", { event: event.title }),
    body: i18n.t(
      event.room
        ? "reminders.notificationBodyWithRoom"
        : "reminders.notificationBody",
      { minutes: minutesBefore, room: event.room },
    ),
  };
}

/**
 * Files the OS request only. The caller owns cancelling any previous request,
 * checking permission and preparing the Android channel, so a batch can do each
 * of those once instead of once per reminder.
 */
async function scheduleReminderRequest(
  event: EventForReminder,
  minutesBefore: number,
  override?: ReminderNotificationContent,
): Promise<string | null> {
  const triggerMs =
    new Date(event.startTime).getTime() - minutesBefore * 60 * 1000;
  if (triggerMs <= Date.now()) {
    return null; // In the past
  }

  const notificationId = `${REMINDER_IDENTIFIER_PREFIX}${event.id}`;
  await ExpoNotifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      ...reminderNotificationContent(event, minutesBefore, override),
      sound: true,
      // Carried so a tap can open the event instead of wherever the app was.
      data: {
        kind: "event-reminder",
        eventId: event.id,
        conventionId: event.conventionId ?? null,
      },
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerMs),
      channelId: REMINDER_CHANNEL_ID,
    },
  });

  return notificationId;
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

  return scheduleReminderRequest(
    event,
    minutesBefore,
    options.notificationContent,
  );
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
  /** Reminders whose fire time has passed; the saved choice is dropped. */
  cleared: number;
  /** Reminders the user still wants but the OS is not holding a request for. */
  paused: number;
  /** Reminders beyond the pending-notification ceiling. */
  overflow: number;
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

  let cleared = 0;
  let paused = 0;
  let overflow = 0;
  let rescheduled = 0;

  const pending: { event: (typeof events)[number]; minutes: number }[] = [];

  for (const event of events) {
    const minutes = event.reminderMinutes;
    if (minutes === null) continue;
    const triggerMs = new Date(event.startTime).getTime() - minutes * 60 * 1000;

    if (triggerMs <= Date.now()) {
      await cancelEventReminder(event.id);
      await eventsRepo.update(event.id, { reminderMinutes: null });
      cleared++;
      continue;
    }

    pending.push({ event, minutes });
  }

  const permission = await getNotificationPermissionStatus();
  if (permission !== "granted") {
    // reminderMinutes is the only record that the user asked for a reminder at
    // all, and a permission the user can turn back on at any moment must not
    // erase it. Drop the OS requests and leave every row intact: the next
    // launch after permission returns re-arms all of them for free.
    for (const { event } of pending) {
      await cancelEventReminder(event.id);
      paused++;
    }
    return { rescheduled, cleared, paused, overflow, staleCancelled };
  }

  await ensureReminderChannel();
  // Nearest first, so the reminders the OS keeps when the ceiling is reached
  // are the ones the user needs soonest rather than whichever rows the
  // database happened to return first.
  pending.sort(
    (a, b) =>
      new Date(a.event.startTime).getTime() -
      a.minutes * 60 * 1000 -
      (new Date(b.event.startTime).getTime() - b.minutes * 60 * 1000),
  );

  for (const { event, minutes } of pending) {
    await cancelEventReminder(event.id);

    if (rescheduled >= MAX_PENDING_REMINDERS) {
      overflow++;
      continue;
    }

    try {
      const notificationId = await scheduleReminderRequest(
        {
          id: event.id,
          title: event.title,
          startTime: event.startTime,
          room: event.room ?? event.location,
          conventionId: event.conventionId,
        },
        minutes,
      );
      if (notificationId) {
        rescheduled++;
        continue;
      }
    } catch {
      // Fall through: a transient OS failure leaves the saved choice alone so
      // the next launch can retry it.
    }

    paused++;
  }

  return { rescheduled, cleared, paused, overflow, staleCancelled };
}
