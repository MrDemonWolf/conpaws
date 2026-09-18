import * as ExpoNotifications from "expo-notifications";
import i18n from "i18next";
import { Platform } from "react-native";
import * as eventsRepo from "@/db/repositories/events";
import { attendanceInterval } from "@/lib/personal-schedule";

const REMINDER_CHANNEL_ID = "event-reminders";
const REMINDER_IDENTIFIER_PREFIX = "reminder-";
const LEAVE_IDENTIFIER_PREFIX = "leave-";
const OVERLAP_IDENTIFIER_PREFIX = "overlap-";
const SCHEDULE_CHANGE_IDENTIFIER_PREFIX = "schedule-change-";
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
  endTime?: string | null;
  personalStartTime?: string | null;
  personalEndTime?: string | null;
  room: string | null;
  conventionId?: string | null;
}

interface PlannedEventForNotification extends EventForReminder {
  isInSchedule: boolean;
  feedStatus?: string | null;
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
  const isLateJoin = reminderStart(event).isPersonal;
  if (!i18n.isInitialized) {
    return {
      title: isLateJoin
        ? `Join ${event.title} soon`
        : `${event.title} starts soon`,
      body: event.room
        ? `${isLateJoin ? "Join" : "Starts"} in ${minutesBefore} min · ${event.room}`
        : `${isLateJoin ? "Join" : "Starts"} in ${minutesBefore} min`,
    };
  }
  return {
    title: i18n.t(
      isLateJoin
        ? "reminders.joinNotificationTitle"
        : "reminders.startNotificationTitle",
      { event: event.title },
    ),
    body: i18n.t(
      isLateJoin
        ? event.room
          ? "reminders.joinNotificationBodyWithRoom"
          : "reminders.joinNotificationBody"
        : event.room
          ? "reminders.startNotificationBodyWithRoom"
          : "reminders.startNotificationBody",
      { minutes: minutesBefore, room: event.room },
    ),
  };
}

function reminderStart(event: EventForReminder): {
  startTime: string;
  isPersonal: boolean;
} {
  const interval = attendanceInterval({
    startTime: event.startTime,
    endTime: event.endTime ?? null,
    personalStartTime: event.personalStartTime,
    personalEndTime: event.personalEndTime,
  });
  const publishedMs = Date.parse(event.startTime);
  const effectiveMs = Date.parse(interval.startTime);
  return {
    startTime: interval.startTime,
    isPersonal:
      !interval.needsReview &&
      event.personalStartTime != null &&
      Number.isFinite(publishedMs) &&
      Number.isFinite(effectiveMs) &&
      effectiveMs !== publishedMs,
  };
}

function reminderTriggerMs(
  event: EventForReminder,
  minutesBefore: number,
): number {
  return Date.parse(reminderStart(event).startTime) - minutesBefore * 60 * 1000;
}

interface PlanNotificationRequest {
  identifier: string;
  triggerMs: number;
  content: ReminderNotificationContent;
  data: Record<string, unknown>;
}

function effectiveStartMs(event: EventForReminder): number {
  return Date.parse(
    attendanceInterval({
      startTime: event.startTime,
      endTime: event.endTime ?? null,
      personalStartTime: event.personalStartTime,
      personalEndTime: event.personalEndTime,
    }).startTime,
  );
}

function leaveNotificationContent(
  event: EventForReminder,
  next?: EventForReminder,
): ReminderNotificationContent {
  if (!i18n.isInitialized) {
    return {
      title: "Your leave time is now",
      body: next
        ? `You planned to leave ${event.title} now. Next: ${next.title}${next.room ? ` · ${next.room}` : ""}`
        : `You planned to leave ${event.title} now.`,
    };
  }
  return {
    title: i18n.t("reminders.leaveNotificationTitle"),
    body: next
      ? i18n.t(
          next.room
            ? "reminders.leaveNotificationBodyWithNextRoom"
            : "reminders.leaveNotificationBodyWithNext",
          { event: event.title, nextEvent: next.title, room: next.room },
        )
      : i18n.t("reminders.leaveNotificationBody", { event: event.title }),
  };
}

/** Build one leave request per explicit chosen leave time. */
export function buildPlanNotificationRequests(
  events: readonly PlannedEventForNotification[],
  now = Date.now(),
): PlanNotificationRequest[] {
  const planned = events.filter(
    (event) => event.isInSchedule && event.feedStatus == null,
  );
  const requests: PlanNotificationRequest[] = [];

  for (const event of planned) {
    if (event.personalEndTime === null || event.personalEndTime === undefined)
      continue;
    const interval = attendanceInterval({
      startTime: event.startTime,
      endTime: event.endTime ?? null,
      personalStartTime: event.personalStartTime,
      personalEndTime: event.personalEndTime,
    });
    const triggerMs = Date.parse(event.personalEndTime);
    if (interval.needsReview || !Number.isFinite(triggerMs) || triggerMs <= now)
      continue;
    const next = planned
      .filter(
        (candidate) =>
          candidate.id !== event.id && effectiveStartMs(candidate) >= triggerMs,
      )
      .sort(
        (left, right) => effectiveStartMs(left) - effectiveStartMs(right),
      )[0];
    requests.push({
      identifier: `${LEAVE_IDENTIFIER_PREFIX}${event.id}`,
      triggerMs,
      content: leaveNotificationContent(event, next),
      data: {
        kind: "leave-reminder",
        eventId: event.id,
        conventionId: event.conventionId ?? null,
      },
    });
  }

  return requests;
}

async function schedulePlanNotificationRequest(
  request: PlanNotificationRequest,
): Promise<string | null> {
  if (request.triggerMs <= Date.now()) return null;
  await ExpoNotifications.scheduleNotificationAsync({
    identifier: request.identifier,
    content: { ...request.content, sound: true, data: request.data },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(request.triggerMs),
      channelId: REMINDER_CHANNEL_ID,
    },
  });
  return request.identifier;
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
  const triggerMs = reminderTriggerMs(event, minutesBefore);
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

export async function cancelStartReminder(eventId: string): Promise<boolean> {
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(
      `${REMINDER_IDENTIFIER_PREFIX}${eventId}`,
    );
    return true;
  } catch {
    return false;
  }
}

export async function cancelLeaveReminder(eventId: string): Promise<boolean> {
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(
      `${LEAVE_IDENTIFIER_PREFIX}${eventId}`,
    );
    return true;
  } catch {
    return false;
  }
}

/** Cancel every exact notification owned by one event. */
export async function cancelEventReminder(eventId: string): Promise<boolean> {
  const results = await Promise.all([
    cancelStartReminder(eventId),
    cancelLeaveReminder(eventId),
  ]);
  return results.every(Boolean);
}

export async function cancelConventionReminders(
  eventIds: string[],
): Promise<boolean> {
  const ids = new Set(eventIds);
  const identifiers = new Set(
    eventIds.flatMap((id) => [
      `${REMINDER_IDENTIFIER_PREFIX}${id}`,
      `${LEAVE_IDENTIFIER_PREFIX}${id}`,
    ]),
  );
  try {
    const scheduled =
      await ExpoNotifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (
        request.identifier.startsWith(OVERLAP_IDENTIFIER_PREFIX) &&
        Array.isArray(request.content.data?.eventIds) &&
        request.content.data.eventIds.some((id) =>
          ids.has(typeof id === "string" ? id : ""),
        )
      ) {
        identifiers.add(request.identifier);
      }
    }
  } catch {
    // Known start and leave identifiers are still safe to clear below.
  }
  const results = await Promise.allSettled(
    [...identifiers].map((identifier) =>
      ExpoNotifications.cancelScheduledNotificationAsync(identifier),
    ),
  );
  return results.every((result) => result.status === "fulfilled");
}

export type ScheduleChangeNotification =
  | {
      kind: "room-change";
      eventId: string;
      conventionId: string;
      event: string;
      previousRoom: string | null;
      room: string | null;
      isInSchedule: boolean;
    }
  | {
      kind: "cancellation";
      eventId: string;
      conventionId: string;
      event: string;
      isInSchedule: boolean;
    };

function scheduleChangeContent(
  notice: ScheduleChangeNotification,
): ReminderNotificationContent {
  if (!i18n.isInitialized) {
    if (notice.kind === "cancellation") {
      return {
        title: `${notice.event} cancelled`,
        body: `The organizer cancelled ${notice.event}. Review your plan.`,
      };
    }
    return {
      title: `${notice.event} moved`,
      body:
        notice.previousRoom && notice.room
          ? `The organizer moved ${notice.event} from ${notice.previousRoom} to ${notice.room}. Your attendance times are unchanged.`
          : `The organizer changed the room for ${notice.event}. Review your plan.`,
    };
  }
  if (notice.kind === "cancellation") {
    return {
      title: i18n.t("reminders.cancellationNotificationTitle", {
        event: notice.event,
      }),
      body: i18n.t("reminders.cancellationNotificationBody", {
        event: notice.event,
      }),
    };
  }
  return {
    title: i18n.t("reminders.roomChangeNotificationTitle", {
      event: notice.event,
    }),
    body:
      notice.previousRoom && notice.room
        ? i18n.t("reminders.roomChangeNotificationBody", {
            event: notice.event,
            previousRoom: notice.previousRoom,
            room: notice.room,
          })
        : i18n.t("reminders.roomChangeNotificationBodyGeneric", {
            event: notice.event,
          }),
  };
}

/** Deliver trusted organizer changes for planned panels without prompting. */
export async function notifyScheduleChanges(
  notices: readonly ScheduleChangeNotification[],
): Promise<number> {
  const planned = [
    ...new Map(
      notices
        .filter((notice) => notice.isInSchedule)
        .map((notice) => [`${notice.kind}:${notice.eventId}`, notice]),
    ).values(),
  ];
  if (
    planned.length === 0 ||
    (await getNotificationPermissionStatus()) !== "granted"
  )
    return 0;
  await ensureReminderChannel();
  let delivered = 0;
  for (const notice of planned) {
    const identifier = `${SCHEDULE_CHANGE_IDENTIFIER_PREFIX}${notice.kind}-${notice.eventId}`;
    await ExpoNotifications.cancelScheduledNotificationAsync(identifier).catch(
      () => undefined,
    );
    await ExpoNotifications.scheduleNotificationAsync({
      identifier,
      content: {
        ...scheduleChangeContent(notice),
        sound: true,
        data: {
          kind: "schedule-change",
          change: notice.kind,
          eventId: notice.eventId,
          conventionId: notice.conventionId,
        },
      },
      trigger: {
        type: ExpoNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    delivered++;
  }
  return delivered;
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
  let cleared = 0;
  let paused = 0;
  let overflow = 0;
  let rescheduled = 0;

  type Pending =
    | {
        kind: "event";
        identifier: string;
        triggerMs: number;
        event: (typeof events)[number];
        minutes: number;
      }
    | ({ kind: "plan" } & PlanNotificationRequest);
  const pending: Pending[] = [];

  for (const event of events) {
    const minutes = event.reminderMinutes;
    if (minutes === null) continue;
    const triggerMs = reminderTriggerMs(event, minutes);

    if (triggerMs <= Date.now()) {
      await cancelStartReminder(event.id);
      await eventsRepo.update(event.id, { reminderMinutes: null });
      cleared++;
      continue;
    }

    pending.push({
      kind: "event",
      identifier: `${REMINDER_IDENTIFIER_PREFIX}${event.id}`,
      triggerMs,
      event,
      minutes,
    });
  }

  const plannedRows = await eventsRepo.getAllInSchedule();
  pending.push(
    ...buildPlanNotificationRequests(plannedRows.map(({ event }) => event)).map(
      (request) => ({ kind: "plan" as const, ...request }),
    ),
  );

  const desiredIdentifiers = new Set(
    pending.map(({ identifier }) => identifier),
  );
  let staleCancelled = 0;
  try {
    const scheduled =
      await ExpoNotifications.getAllScheduledNotificationsAsync();
    const staleIdentifiers = scheduled
      .map(({ identifier }) => identifier)
      .filter(
        (identifier) =>
          (identifier.startsWith(REMINDER_IDENTIFIER_PREFIX) ||
            identifier.startsWith(LEAVE_IDENTIFIER_PREFIX) ||
            identifier.startsWith(OVERLAP_IDENTIFIER_PREFIX)) &&
          !desiredIdentifiers.has(identifier),
      );
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
  if (permission !== "granted") {
    // SQLite retains the user's explicit reminder and attendance choices, and
    // a permission the user can turn back on at any moment must not erase
    // them. Drop the OS requests and leave every row intact: the next
    // launch after permission returns re-arms all of them for free.
    for (const request of pending) {
      await ExpoNotifications.cancelScheduledNotificationAsync(
        request.identifier,
      ).catch(() => undefined);
      paused++;
    }
    return { rescheduled, cleared, paused, overflow, staleCancelled };
  }

  await ensureReminderChannel();
  // Nearest first, so the reminders the OS keeps when the ceiling is reached
  // are the ones the user needs soonest rather than whichever rows the
  // database happened to return first.
  pending.sort((a, b) => a.triggerMs - b.triggerMs);

  for (const request of pending) {
    await ExpoNotifications.cancelScheduledNotificationAsync(
      request.identifier,
    ).catch(() => undefined);

    if (rescheduled >= MAX_PENDING_REMINDERS) {
      overflow++;
      continue;
    }

    try {
      const notificationId =
        request.kind === "event"
          ? await scheduleReminderRequest(
              {
                id: request.event.id,
                title: request.event.title,
                startTime: request.event.startTime,
                endTime: request.event.endTime,
                personalStartTime: request.event.personalStartTime,
                personalEndTime: request.event.personalEndTime,
                room: request.event.room ?? request.event.location,
                conventionId: request.event.conventionId,
              },
              request.minutes,
            )
          : await schedulePlanNotificationRequest(request);
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
