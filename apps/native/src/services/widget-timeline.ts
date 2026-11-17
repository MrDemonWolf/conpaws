import { conventionDayKey, fromConventionTime } from "@/lib/convention-time";
import type { ConPawsWidgetProps } from "@/widgets/ConPawsWidget.types";
import type { WidgetEventSnapshot, WidgetSnapshot } from "./widget-snapshot";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const MAX_ENTRIES = 256;
const MAX_BYTES = 2 * 1024 * 1024;

function end(event: WidgetEventSnapshot): number {
  return event.endAtMs ?? event.startAtMs + HOUR;
}

/** Each entry needs only the last event, current events and the next four. */
function snapshotAt(
  snapshot: WidgetSnapshot,
  date: number,
  dayKey: (date: number, zone: string) => string,
): WidgetSnapshot {
  return {
    ...snapshot,
    conventions: snapshot.conventions.map((convention) => {
      const current = convention.events.filter(
        (event) => event.startAtMs <= date && end(event) > date,
      );
      const next = convention.events
        .filter((event) => event.startAtMs > date)
        .slice(0, 4);
      const last = convention.events
        .filter((event) => end(event) <= date)
        .at(-1);
      const keep = new Set([...current, ...next, ...(last ? [last] : [])]);
      const day = dayKey(date, convention.timeZoneIdentifier);
      return {
        ...convention,
        eventCount: convention.events.length,
        remainingTodayCount: convention.events.filter(
          (event) =>
            event.startAtMs > date &&
            dayKey(event.startAtMs, convention.timeZoneIdentifier) === day,
        ).length,
        events: convention.events.filter((event) => keep.has(event)),
      };
    }),
  };
}

export function buildWidgetTimeline(snapshot: WidgetSnapshot): Array<{
  date: Date;
  props: ConPawsWidgetProps;
}> {
  const now = snapshot.generatedAtMs;
  const daysByZone = new Map<string, Map<number, string>>();
  const dayKey = (date: number, zone: string): string => {
    let days = daysByZone.get(zone);
    if (!days) {
      days = new Map();
      daysByZone.set(zone, days);
    }
    let day = days.get(date);
    if (day === undefined) {
      day = conventionDayKey(new Date(date), zone);
      days.set(date, day);
    }
    return day;
  };
  const horizon = now + 48 * HOUR;
  const points = new Set([now, now + 30 * MINUTE]);
  const add = (date: number) => {
    if (Number.isFinite(date) && date > now && date < horizon) points.add(date);
  };
  for (let date = now + HOUR; date < horizon; date += HOUR) add(date);
  for (const convention of snapshot.conventions) {
    add(convention.startAtMs);
    add(convention.endAtMs);
    const [year, month, day] = conventionDayKey(
      new Date(now),
      convention.timeZoneIdentifier,
    )
      .split("-")
      .map(Number);
    if (year && month && day) {
      for (let offset = 1; offset <= 3; offset++) {
        add(
          fromConventionTime(
            { year, month, day: day + offset },
            convention.timeZoneIdentifier,
          ).getTime(),
        );
      }
    }
    for (const event of convention.events) {
      add(event.startAtMs);
      add(end(event));
      const reminder = event.reminderMinutes;
      if (reminder !== null && reminder > 0) {
        add(event.startAtMs - reminder * MINUTE);
        // Whole minutes change only during the final hour of a reminder window.
        const begin = Math.max(
          now,
          event.startAtMs - Math.min(reminder, 60) * MINUTE,
        );
        for (
          let date = event.startAtMs - MINUTE;
          date > begin && date > now;
          date -= MINUTE
        )
          add(date);
      }
    }
  }

  const timeline: ReturnType<typeof buildWidgetTimeline> = [];
  let bytes = 0;
  let expires = horizon;
  for (const date of [...points].sort((a, b) => a - b)) {
    const props = { snapshot: snapshotAt(snapshot, date, dayKey) };
    // UTF-16 length * 3 bounds UTF-8 size, including non-Latin translations.
    const size = JSON.stringify(props).length * 3;
    if (
      timeline.length >= MAX_ENTRIES - 1 ||
      (timeline.length > 0 && bytes + size > MAX_BYTES)
    ) {
      expires = date;
      break;
    }
    timeline.push({ date: new Date(date), props });
    bytes += size;
  }
  // shortcut: prebuilt entries cover up to 48h; opening the app renews them offline.
  // A terminal refresh state prevents Expo's stored last entry freezing on an old event.
  timeline.push({
    date: new Date(expires),
    props: { snapshot: { ...snapshot, conventions: [] }, expired: true },
  });
  return timeline;
}
