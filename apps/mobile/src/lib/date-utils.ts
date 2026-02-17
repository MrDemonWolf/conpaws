import {
  format,
  parseISO,
  isWithinInterval,
  isBefore,
  isAfter,
  differenceInDays,
} from "date-fns";
import type { ConventionStatus, ConventionEvent } from "@/types";

export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (format(start, "MMM yyyy") === format(end, "MMM yyyy")) {
    return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
}

export function formatTime(dateString: string): string {
  return format(parseISO(dateString), "h:mm a");
}

export function formatEventTime(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export function formatDayHeader(dateString: string): string {
  return format(parseISO(dateString), "EEEE, MMM d");
}

export function getConventionStatus(
  startDate: string,
  endDate: string,
): ConventionStatus {
  const now = new Date();
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (isAfter(now, end)) return "ended";
  if (isWithinInterval(now, { start, end })) return "active";
  return "upcoming";
}

export function getRelativeDate(dateString: string): string {
  const date = parseISO(dateString);
  const now = new Date();
  const days = differenceInDays(date, now);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days <= 7) return `In ${days} days`;
  if (days < 0 && days >= -7) return `${Math.abs(days)} days ago`;
  return format(date, "MMM d, yyyy");
}

export function groupEventsByDay(
  events: ConventionEvent[],
): { date: string; title: string; data: ConventionEvent[] }[] {
  const grouped = new Map<string, ConventionEvent[]>();

  for (const event of events) {
    const day = format(parseISO(event.startTime), "yyyy-MM-dd");
    const existing = grouped.get(day) ?? [];
    existing.push(event);
    grouped.set(day, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      title: formatDayHeader(date),
      data: data.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
}
