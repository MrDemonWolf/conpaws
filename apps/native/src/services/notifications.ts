import * as ExpoNotifications from "expo-notifications";
import i18n from "i18next";
import { Platform } from "react-native";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { plannedEvent } from "@/lib/drop-in-visit";

const REMINDER_CHANNEL_ID = "event-reminders";
const REMINDER_IDENTIFIER_PREFIX = "reminder-";
const TEST_NOTIFICATION_IDENTIFIER_PREFIX = "developer-test-";

/**
 * What marks a notification as a panel reminder. The phone's tap handler and
 * the Watch app both read these back; the Watch's copies live in
 * `targets/_shared/ConPawsReminderNotification.swift`, and
 * `notifications-watch-contract.test.ts` holds the two together.
 */
export const REMINDER_CATEGORY_IDENTIFIER = "conpaws.reminder";
export const REMINDER_NOTIFICATION_KIND = "event-reminder";

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

function notificationPermissionStatus({
  status,
  canAskAgain,
  ios,
}: ExpoNotifications.NotificationPermissionsStatus): PermissionStatus {
  switch (ios?.status) {
    case ExpoNotifications.IosAuthorizationStatus.AUTHORIZED:
    case ExpoNotifications.IosAuthorizationStatus.PROVISIONAL:
    case ExpoNotifications.IosAuthorizationStatus.EPHEMERAL:
      return "granted";
    case ExpoNotifications.IosAuthorizationStatus.DENIED:
      return "denied";
    case ExpoNotifications.IosAuthorizationStatus.NOT_DETERMINED:
      return "undetermined";
  }
  // Android 13+ reports POST_NOTIFICATIONS as "denied" before the app has ever
  // asked; only canAskAgain tells that apart from a real refusal. Treating it
  // as denied would send the user to system settings instead of the prompt.
  if (status === "denied" && canAskAgain) return "undetermined";
  return status as PermissionStatus;
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  await ensureReminderChannel();
  if ((await getNotificationPermissionStatus()) === "granted") return "granted";
  return notificationPermissionStatus(
    await ExpoNotifications.requestPermissionsAsync(),
  );
}

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  return notificationPermissionStatus(
    await ExpoNotifications.getPermissionsAsync(),
  );
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
  endTime?: string | null;
  visitStartTime?: string | null;
  visitEndTime?: string | null;
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

/**
 * The translation key for a reminder's body. An "At event time" reminder fires
 * as the event starts, so it says so instead of "Starts in 0 min". The reminder
 * picker builds its own copy of this text and uses this too.
 */
export function reminderBodyKey(
  minutesBefore: number,
  room: string | null | undefined,
) {
  if (minutesBefore === 0) {
    return room
      ? "reminders.notificationBodyNowWithRoom"
      : "reminders.notificationBodyNow";
  }
  return room
    ? "reminders.notificationBodyWithRoom"
    : "reminders.notificationBody";
}

function reminderNotificationContent(
  event: EventForReminder,
  minutesBefore: number,
  override?: ReminderNotificationContent,
): ReminderNotificationContent {
  if (override) return override;
  if (!i18n.isInitialized) {
    const starts =
      minutesBefore === 0 ? "Starting now" : `Starts in ${minutesBefore} min`;
    return {
      title: `Reminder for ${event.title}`,
      body: event.room ? `${starts} · ${event.room}` : starts,
    };
  }
  return {
    title: i18n.t("reminders.notificationTitle", { event: event.title }),
    body: i18n.t(reminderBodyKey(minutesBefore, event.room), {
      minutes: minutesBefore,
      room: event.room,
    }),
  };
}

/**
 * How iOS delivers a reminder, beyond its words.
 *
 * - Time Sensitive: a reminder is the one alert the wearer asked for, at the
 *   moment it matters, and a Focus set for a panel room or a line would
 *   otherwise hold it until the Focus ends. It needs the
 *   `com.apple.developer.usernotifications.time-sensitive` entitlement
 *   (app.config.ts), and people can still turn it off for this app or for a
 *   Focus.
 * - The category marks it as a reminder wherever iOS shows it, the Watch
 *   included. It carries no actions, so iOS needs no registered category for
 *   it: an unregistered one only means no custom buttons.
 * - The thread groups a convention's reminders together in Notification
 *   Center and on the Watch.
 *
 * Android gets none of these: it has no Time Sensitive level, and
 * expo-notifications turns a thread into a notification group with a summary
 * of its own there, a change that has not been checked on a device.
 */
function reminderDelivery(
  conventionId: string | null | undefined,
): Partial<ExpoNotifications.NotificationContentInput> {
  if (Platform.OS !== "ios") return {};
  return {
    interruptionLevel: "timeSensitive",
    categoryIdentifier: REMINDER_CATEGORY_IDENTIFIER,
    ...(conventionId ? { threadIdentifier: conventionId } : {}),
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
      ...reminderDelivery(event.conventionId),
      sound: true,
      // Carried so a tap can open the event instead of wherever the app was,
      // on the phone and, through ConPawsReminderNotification, on the Watch.
      data: {
        kind: REMINDER_NOTIFICATION_KIND,
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
  sourceEvent: EventForReminder,
  minutesBefore: number,
  options: ScheduleReminderOptions = {},
): Promise<string | null> {
  const event = plannedEvent({
    ...sourceEvent,
    endTime: sourceEvent.endTime ?? null,
    isInSchedule: true,
  });
  const notificationId = `${REMINDER_IDENTIFIER_PREFIX}${event.id}`;

  // Always clear a stale request before an early return or replacement.
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // May not exist.
  }

  if (!event.isInSchedule) return null;
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

let reminderQueue: Promise<unknown> = Promise.resolve();

/**
 * Runs reminder work one piece at a time.
 *
 * The reconcile reads every saved reminder and then re-files each one after
 * several native round trips. A remove that cancels the OS request and clears
 * the row in that gap, as a Watch tap drained at launch does, is undone by the
 * reconcile re-filing from what it read first. Work that cancels a reminder
 * and clears the row goes through here as one step, so it lands wholly before
 * or after a reconcile.
 *
 * Not re-entrant: never call it from inside work it is already running, and
 * never wrap `cancelEventReminder` itself, which the reconcile calls.
 */
export function withReminderLock<T>(work: () => Promise<T>): Promise<T> {
  const run = reminderQueue.then(() => work());
  reminderQueue = run.catch(() => undefined);
  return run;
}

export function reconcileEventReminders(): Promise<ReminderReconciliationResult> {
  return withReminderLock(reconcileEventRemindersNow);
}

async function reconcileEventRemindersNow(): Promise<ReminderReconciliationResult> {
  const events = (await eventsRepo.getAllWithReminders()).map(plannedEvent);
  const archivedConventionIds = new Set(
    (await conventionsRepo.getAll())
      .filter((convention) => convention.archivedAt !== null)
      .map((convention) => convention.id),
  );
  const armableEvents = events.filter(
    (event) =>
      event.reminderMinutes !== null &&
      event.feedStatus === null &&
      !archivedConventionIds.has(event.conventionId),
  );
  const eventIds = new Set(armableEvents.map((event) => event.id));
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
    if (!eventIds.has(event.id)) {
      await cancelEventReminder(event.id);
      continue;
    }
    const minutes = event.reminderMinutes;
    if (minutes === null) continue;
    const triggerMs = new Date(event.startTime).getTime() - minutes * 60 * 1000;

    if (triggerMs <= Date.now()) {
      await cancelEventReminder(event.id);
      await eventsRepo.clearPassedReminder(event.id);
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
