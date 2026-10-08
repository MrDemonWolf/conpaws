import {
  conventionDayKey,
  formatInConventionTime,
  fromConventionTime,
  isValidTimeZone,
} from "@/lib/convention-time";

export const CATALOG_AVAILABILITIES = [
  "unknown",
  "not-open",
  "open",
  "waitlist",
  "sold-out",
  "closed",
] as const;

export const CATALOG_SCHEDULE_STATUSES = [
  "not-released",
  "partial",
  "complete",
] as const;

export interface CatalogSession {
  id: string;
  title: string;
  description: string;
  room: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled";
}

export interface CatalogEdition {
  id: string;
  slug: string;
  name: string;
  acronym: string;
  city: string;
  region: string;
  country: string;
  startsOn: string;
  endsOn: string;
  timezone: string;
  venue: string;
  availability: (typeof CATALOG_AVAILABILITIES)[number];
  scheduleStatus: (typeof CATALOG_SCHEDULE_STATUSES)[number];
  revision: number;
  sessions: CatalogSession[];
}

export interface CatalogListResponse {
  version: 1;
  conventions: CatalogEdition[];
}

export interface CatalogScheduleResponse {
  version: 1;
  conventionId: string;
  slug: string;
  revision: number;
  timezone: string;
  status: (typeof CATALOG_SCHEDULE_STATUSES)[number];
  sessions: CatalogSession[];
}

export type CatalogSchedule = CatalogScheduleResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isWallClock(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  )
    return false;
  const day = value.slice(0, 10);
  const clock = value.slice(11);
  if (!isDateKey(day)) return false;
  const [hour, minute] = clock.split(":").map(Number);
  return hour < 24 && minute < 60;
}

function isScheduleStatus(
  value: unknown,
): value is CatalogScheduleResponse["status"] {
  return CATALOG_SCHEDULE_STATUSES.includes(
    value as CatalogScheduleResponse["status"],
  );
}

function isSession(value: unknown): value is CatalogSession {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.description === "string" &&
    typeof value.room === "string" &&
    isWallClock(value.startsAt) &&
    isWallClock(value.endsAt) &&
    (value.status === "scheduled" || value.status === "cancelled")
  );
}

function isSessionList(
  value: unknown,
  timezone: string,
): value is CatalogSession[] {
  return (
    Array.isArray(value) &&
    value.every(
      (session) =>
        isSession(session) &&
        isValidCatalogSessionTime(session.startsAt, timezone) &&
        isValidCatalogSessionTime(session.endsAt, timezone),
    )
  );
}

export function isCatalogEdition(value: unknown): value is CatalogEdition {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.slug) &&
    isNonEmptyString(value.name) &&
    typeof value.acronym === "string" &&
    typeof value.city === "string" &&
    typeof value.region === "string" &&
    typeof value.country === "string" &&
    isDateKey(value.startsOn) &&
    isDateKey(value.endsOn) &&
    value.startsOn <= value.endsOn &&
    isValidTimeZone(value.timezone) &&
    typeof value.venue === "string" &&
    CATALOG_AVAILABILITIES.includes(
      value.availability as CatalogEdition["availability"],
    ) &&
    isScheduleStatus(value.scheduleStatus) &&
    Number.isInteger(value.revision) &&
    (value.revision as number) > 0 &&
    isSessionList(value.sessions, value.timezone)
  );
}

export function isCatalogListResponse(
  value: unknown,
): value is CatalogListResponse {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.conventions) &&
    value.conventions.every(isCatalogEdition)
  );
}

export function isCatalogScheduleResponse(
  value: unknown,
): value is CatalogScheduleResponse {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isNonEmptyString(value.conventionId) &&
    isNonEmptyString(value.slug) &&
    Number.isInteger(value.revision) &&
    (value.revision as number) > 0 &&
    isValidTimeZone(value.timezone) &&
    isScheduleStatus(value.status) &&
    isSessionList(value.sessions, value.timezone)
  );
}

/** A wall-clock value is meaningful only if it round-trips through its zone. */
export function isValidCatalogSessionTime(
  value: string,
  timezone: string,
): boolean {
  if (!isWallClock(value) || !isValidTimeZone(timezone)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const [hour, minute] = value.slice(11).split(":").map(Number);
  const instant = fromConventionTime(
    { year, month, day, hour, minute },
    timezone,
  );
  return (
    Number.isFinite(instant.getTime()) &&
    formatInConventionTime(instant, timezone, "yyyy-MM-dd'T'HH:mm") === value &&
    conventionDayKey(instant, timezone) === value.slice(0, 10)
  );
}
