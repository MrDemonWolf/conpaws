import { requireOptionalNativeModule } from "expo";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { reportError } from "@/lib/error-reporting";
import { attendanceTimeError, intervalsOverlap } from "@/lib/personal-schedule";
import { reconcileEventReminders } from "@/services/notifications";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

interface WatchLeaveTimeEdit {
  requestId: string;
  conventionId: string;
  eventId: string;
  expectedEndAtMs: number;
  newEndAtMs: number;
}

interface NativeWatchPlanEditModule {
  addListener(
    eventName: "onWatchLeaveTimeEdit",
    listener: (request: WatchLeaveTimeEdit) => void,
  ): { remove(): void };
  completeWatchLeaveTimeEdit(requestId: string, success: boolean): void;
}

const nativeModule =
  requireOptionalNativeModule<NativeWatchPlanEditModule>("ConPawsWidgets");

function isValidRequest(value: WatchLeaveTimeEdit): boolean {
  return (
    typeof value?.requestId === "string" &&
    value.requestId.length > 0 &&
    typeof value.conventionId === "string" &&
    value.conventionId.length > 0 &&
    typeof value.eventId === "string" &&
    value.eventId.length > 0 &&
    Number.isFinite(value.expectedEndAtMs) &&
    Number.isFinite(value.newEndAtMs) &&
    Math.abs(value.newEndAtMs - value.expectedEndAtMs - 300_000) < 1
  );
}

export function validateWatchLeaveTimeEdit(
  event: ConventionEvent | undefined,
  request: WatchLeaveTimeEdit,
): string | null {
  if (!isValidRequest(request)) return null;
  if (
    !event ||
    event.conventionId !== request.conventionId ||
    !event.isInSchedule ||
    event.feedStatus !== null ||
    event.personalEndTime === null
  ) {
    return null;
  }

  const savedEndAtMs = Date.parse(event.personalEndTime);
  if (
    !Number.isFinite(savedEndAtMs) ||
    Math.abs(savedEndAtMs - request.expectedEndAtMs) >= 1
  ) {
    return null;
  }

  const personalEndTime = new Date(request.newEndAtMs).toISOString();
  return attendanceTimeError({ ...event, personalEndTime }) === null
    ? personalEndTime
    : null;
}

async function handleWatchLeaveTimeEdit(
  request: WatchLeaveTimeEdit,
): Promise<void> {
  if (!nativeModule) return;
  let success = false;
  let restorePersonalEndTime: (() => Promise<void>) | null = null;
  try {
    const event = isValidRequest(request)
      ? await eventsRepo.getById(request.eventId)
      : undefined;
    if (!event) return;
    const personalEndTime = validateWatchLeaveTimeEdit(event, request);
    if (!personalEndTime) return;

    const candidate = { ...event, personalEndTime };
    const plannedEvents = await eventsRepo.getByConventionId(
      request.conventionId,
    );
    const createsConflict = plannedEvents.some(
      (other) =>
        other.id !== candidate.id &&
        other.conventionId === candidate.conventionId &&
        other.isInSchedule &&
        other.feedStatus === null &&
        intervalsOverlap(candidate, other),
    );
    if (createsConflict) return;

    await eventsRepo.update(request.eventId, { personalEndTime });
    restorePersonalEndTime = () =>
      eventsRepo.update(request.eventId, {
        personalEndTime: event.personalEndTime,
      });
    const savedEvent = await eventsRepo.getById(request.eventId);
    if (savedEvent?.personalEndTime !== personalEndTime) return;
    success = await publishWidgetSnapshot();
    if (!success) return;
    try {
      await reconcileEventReminders();
    } catch (error) {
      reportError(error, { scope: "watch-plan-edit.reminders" });
    }
  } catch (error) {
    reportError(error, { scope: "watch-plan-edit" });
  } finally {
    if (!success && restorePersonalEndTime) {
      try {
        await restorePersonalEndTime();
      } catch (error) {
        reportError(error, { scope: "watch-plan-edit.rollback" });
      }
    }
    nativeModule.completeWatchLeaveTimeEdit(request.requestId, success);
  }
}

let isSetup = false;

/** Register once, early in app launch, so Watch messages receive a real ack. */
export function setupWatchPlanEdits(): void {
  if (isSetup || !nativeModule) return;
  isSetup = true;
  nativeModule.addListener("onWatchLeaveTimeEdit", (request) => {
    void handleWatchLeaveTimeEdit(request);
  });
}
