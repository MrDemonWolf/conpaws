import { buildConPawsPreviewFixture } from "@/fixtures/conpaws-preview";
import { formatInConventionTime } from "@/lib/convention-time";
import { ScheduleFetchCancelledError } from "@/lib/sched-extractor";
import { CatalogNotFoundError } from "./client";
import type { CatalogSource } from "./source";
import type { CatalogEdition, CatalogSchedule, CatalogSession } from "./types";

const TIME_ZONE = "America/New_York";

function addDays(dayKey: string, amount: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount))
    .toISOString()
    .slice(0, 10);
}

function dayOffset(from: string, to: string): number {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000
  );
}

function shiftWallClock(
  value: string,
  sourceStart: string,
  targetStart: string,
): string {
  const local = formatInConventionTime(value, TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
  const targetDay = addDays(
    targetStart,
    dayOffset(sourceStart, local.slice(0, 10)),
  );
  return `${targetDay}${local.slice(10)}`;
}

function buildEdition(
  slug: string,
  name: string,
  startsOn: string,
  scheduleStatus: CatalogEdition["scheduleStatus"],
  events: ReturnType<typeof buildConPawsPreviewFixture>["events"],
  sourceStart: string,
  cancelledFirst = false,
): CatalogEdition {
  const sessions: CatalogSession[] =
    scheduleStatus === "not-released"
      ? []
      : events.map((event, index) => ({
          id: `${slug}-${event.sourceUid}`,
          title: event.title,
          description: event.description ?? "",
          room: event.room ?? "",
          startsAt: shiftWallClock(event.startTime, sourceStart, startsOn),
          endsAt: shiftWallClock(
            event.endTime ?? event.startTime,
            sourceStart,
            startsOn,
          ),
          status: cancelledFirst && index === 0 ? "cancelled" : "scheduled",
        }));

  return {
    id: `sample-${slug}`,
    slug,
    name,
    acronym: slug === "sample-lakeside-fur-con" ? "SLFC" : "SFC",
    city: "Sample Harbor",
    region: "Sample District",
    country: "Sample Country",
    startsOn,
    // The preview programme spans four days.
    endsOn: addDays(startsOn, 3),
    timezone: TIME_ZONE,
    venue: "Sample Convention Hall",
    availability: "unknown",
    scheduleStatus,
    revision: 1,
    sessions,
  };
}

export function buildFixtureCatalog(now = new Date()): CatalogEdition[] {
  const fixture = buildConPawsPreviewFixture(now);
  const today = addDays(fixture.convention.startDate, 1);
  return [
    buildEdition(
      "sample-lakeside-fur-con",
      "Sample Lakeside Fur Con",
      addDays(today, 12),
      "complete",
      fixture.events,
      fixture.convention.startDate,
      true,
    ),
    buildEdition(
      "sample-meadow-creature-gathering",
      "Sample Meadow Creature Gathering",
      addDays(today, 40),
      "not-released",
      fixture.events,
      fixture.convention.startDate,
    ),
    buildEdition(
      "sample-riverlight-fur-con",
      "Sample Riverlight Fur Con",
      addDays(today, -32),
      "complete",
      fixture.events,
      fixture.convention.startDate,
    ),
  ];
}

export const fixtureCatalogSource: CatalogSource = {
  kind: "fixture",
  async list(signal) {
    if (signal?.aborted) throw new ScheduleFetchCancelledError();
    return buildFixtureCatalog();
  },
  async schedule(slug, signal): Promise<CatalogSchedule> {
    if (signal?.aborted) throw new ScheduleFetchCancelledError();
    const edition = buildFixtureCatalog().find((item) => item.slug === slug);
    if (!edition) throw new CatalogNotFoundError();
    return {
      version: 1,
      conventionId: edition.id,
      slug: edition.slug,
      revision: edition.revision,
      timezone: edition.timezone,
      status: edition.scheduleStatus,
      sessions: edition.sessions,
    };
  },
};
