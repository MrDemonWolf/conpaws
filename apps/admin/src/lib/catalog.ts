import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }, "Enter a real calendar date.");

const slug = z
  .string()
  .trim()
  .min(2)
  .max(96)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase words separated by hyphens.",
  );

const timezone = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA time zone.");

const httpsUrl = z
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Use an HTTPS organizer website.",
  });

export const availabilityOptions = [
  "unknown",
  "not-open",
  "open",
  "waitlist",
  "sold-out",
  "closed",
] as const;
export const scheduleStatusOptions = [
  "not-released",
  "partial",
  "complete",
] as const;
export const availabilityLabels = {
  unknown: "Not confirmed",
  "not-open": "Registration not open",
  open: "Registration open",
  waitlist: "Waitlist",
  "sold-out": "Sold out",
  closed: "Registration closed",
} satisfies Record<(typeof availabilityOptions)[number], string>;
export const scheduleStatusLabels = {
  "not-released": "Schedule not released",
  partial: "Partial schedule",
  complete: "Full schedule",
} satisfies Record<(typeof scheduleStatusOptions)[number], string>;

export const conventionInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    acronym: z.string().trim().max(16).default(""),
    slug,
    city: z.string().trim().min(1).max(80),
    region: z.string().trim().max(80).default(""),
    country: z.string().trim().min(2).max(80),
    startsOn: isoDate,
    endsOn: isoDate,
    timezone,
    venue: z.string().trim().max(160).default(""),
    officialUrl: httpsUrl,
    availability: z.enum(availabilityOptions).default("unknown"),
    scheduleStatus: z.enum(scheduleStatusOptions).default("not-released"),
    sourceVerifiedAt: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      isoDate.nullable(),
    ),
  })
  .refine((value) => value.endsOn >= value.startsOn, {
    path: ["endsOn"],
    message: "The end date must be on or after the start date.",
  });

export const scheduleEventInputSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    description: z.string().trim().max(1000).default(""),
    room: z.string().trim().max(100).default(""),
    startsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .refine(isValidLocalDateTime, "Enter a valid local date and time."),
    endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .refine(isValidLocalDateTime, "Enter a valid local date and time."),
    status: z.enum(["scheduled", "cancelled"]).default("scheduled"),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "The end time must be after the start time.",
  });

export const memberInputSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  role: z.enum(["owner", "editor"]),
});

export type ConventionInput = z.infer<typeof conventionInputSchema>;
export type ScheduleEventInput = z.infer<typeof scheduleEventInputSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;

export function todayInTimezone(timezone: string, date = new Date()) {
  let effectiveTimezone = timezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: effectiveTimezone });
  } catch {
    effectiveTimezone = "UTC";
  }
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: effectiveTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export interface PublicScheduleEvent {
  id: string;
  title: string;
  description: string;
  room: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled";
}

export interface PublicConvention {
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
  availability: (typeof availabilityOptions)[number];
  scheduleStatus: (typeof scheduleStatusOptions)[number];
  revision: number;
  sessions: PublicScheduleEvent[];
}

export const publicConventionSchema = z.object({
  id: z.string().min(1),
  slug,
  name: z.string().min(2).max(120),
  acronym: z.string().max(16),
  city: z.string().min(1).max(80),
  region: z.string().max(80),
  country: z.string().min(2).max(80),
  startsOn: isoDate,
  endsOn: isoDate,
  timezone,
  venue: z.string().max(160),
  availability: z.enum(availabilityOptions),
  scheduleStatus: z.enum(scheduleStatusOptions),
  revision: z.number().int().positive(),
  sessions: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(2).max(140),
      description: z.string().max(1000),
      room: z.string().max(100),
      startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      status: z.enum(["scheduled", "cancelled"]),
    }),
  ),
});

export function toPublicConvention(input: {
  convention: {
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
    availability: (typeof availabilityOptions)[number];
    scheduleStatus: (typeof scheduleStatusOptions)[number];
  };
  revision: number;
  sessions: Array<{
    id: string;
    title: string;
    description: string;
    room: string;
    startsAt: string;
    endsAt: string;
    status: "scheduled" | "cancelled";
  }>;
}): PublicConvention {
  return {
    id: input.convention.id,
    slug: input.convention.slug,
    name: input.convention.name,
    acronym: input.convention.acronym,
    city: input.convention.city,
    region: input.convention.region,
    country: input.convention.country,
    startsOn: input.convention.startsOn,
    endsOn: input.convention.endsOn,
    timezone: input.convention.timezone,
    venue: input.convention.venue,
    availability: input.convention.availability,
    scheduleStatus: input.convention.scheduleStatus,
    revision: input.revision,
    sessions: input.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      description: session.description,
      room: session.room,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      status: session.status,
    })),
  };
}

export function getPublicationIssues(input: {
  convention: ConventionInput & { sourceVerifiedAt: string | null };
  sessions: ScheduleEventInput[];
  today: string;
}) {
  const issues: string[] = [];
  if (!input.convention.sourceVerifiedAt) {
    issues.push("Record the date you checked the organizer source.");
  } else if (input.convention.sourceVerifiedAt > input.today) {
    issues.push("The source check date cannot be in the future.");
  }
  if (
    input.convention.scheduleStatus === "not-released" &&
    input.sessions.length > 0
  ) {
    issues.push("Choose partial or complete when publishing sessions.");
  }
  if (
    input.convention.scheduleStatus !== "not-released" &&
    input.sessions.length === 0
  ) {
    issues.push("Add at least one session or mark the schedule not released.");
  }
  for (const session of input.sessions) {
    const startsOn = session.startsAt.slice(0, 10);
    const endsOn = session.endsAt.slice(0, 10);
    if (
      startsOn < input.convention.startsOn ||
      startsOn > input.convention.endsOn ||
      endsOn > input.convention.endsOn
    ) {
      issues.push(`“${session.title}” falls outside the convention dates.`);
    }
  }
  return issues;
}

export function getSnapshotChanges(
  previous: PublicConvention | null,
  next: PublicConvention,
) {
  if (!previous) {
    return [
      `First publication: ${next.name}, ${next.city}, ${next.country}.`,
      `${next.sessions.length} session(s); schedule ${next.scheduleStatus.replaceAll("-", " ")}.`,
      `Registration: ${next.availability.replaceAll("-", " ")}.`,
    ];
  }

  const changes: string[] = [];
  const fields: Array<[keyof PublicConvention, string]> = [
    ["slug", "Public URL"],
    ["name", "Name"],
    ["acronym", "Short name"],
    ["city", "City"],
    ["region", "Region"],
    ["country", "Country"],
    ["startsOn", "Start date"],
    ["endsOn", "End date"],
    ["timezone", "Time zone"],
    ["venue", "Venue"],
    ["availability", "Registration"],
    ["scheduleStatus", "Schedule status"],
  ];
  for (const [key, label] of fields) {
    const before = String(previous[key]);
    const after = String(next[key]);
    if (before !== after) {
      changes.push(`${label}: ${before || "—"} → ${after || "—"}`);
    }
  }

  const beforeSessions = new Map(
    previous.sessions.map((item) => [item.id, item]),
  );
  const afterSessions = new Map(next.sessions.map((item) => [item.id, item]));
  for (const [id, item] of afterSessions) {
    const before = beforeSessions.get(id);
    if (!before) {
      changes.push(
        `Added session: ${item.title} (${item.startsAt}–${item.endsAt}${item.room ? ` · ${item.room}` : ""}).`,
      );
    } else {
      const sessionFields: Array<[keyof PublicScheduleEvent, string]> = [
        ["title", "Title"],
        ["description", "Description"],
        ["room", "Room"],
        ["startsAt", "Starts"],
        ["endsAt", "Ends"],
        ["status", "Status"],
      ];
      for (const [key, label] of sessionFields) {
        if (before[key] !== item[key]) {
          changes.push(
            `Session “${before.title}” ${label.toLowerCase()}: ${before[key] || "—"} → ${item[key] || "—"}`,
          );
        }
      }
    }
  }
  for (const [id, item] of beforeSessions) {
    if (!afterSessions.has(id)) changes.push(`Removed session: ${item.title}.`);
  }
  return changes.length ? changes : ["No attendee-visible changes."];
}

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidLocalDateTime(value: string) {
  const date = new Date(`${value}:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 16) === value
  );
}
