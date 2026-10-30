import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conventionEvents, conventions } from "@/db/schema";
import {
  BLANK_PREVIEW_CONVENTION_ID,
  buildBlankPreviewFixture,
  buildConPawsPreviewFixture,
  PREVIEW_CONVENTION_ID,
} from "@/fixtures/conpaws-preview";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { cancelConventionReminders } from "@/services/notifications";

export function getPreviewConventionFixtures(
  isDev: boolean,
  appVariant: unknown,
) {
  if (!developerToolsEnabled(isDev, appVariant)) return null;
  return [buildConPawsPreviewFixture(), buildBlankPreviewFixture()] as const;
}

export async function addPreviewConventions(
  isDev: boolean,
  appVariant: unknown,
): Promise<string | null> {
  const fixtures = getPreviewConventionFixtures(isDev, appVariant);
  if (!fixtures) return null;

  db.transaction((tx) => {
    for (const fixture of fixtures) {
      // Opening samples again must preserve the tester's edits and selections.
      const inserted = tx
        .insert(conventions)
        .values(fixture.convention)
        .onConflictDoNothing({ target: conventions.id })
        .returning({ id: conventions.id })
        .get();
      if (inserted && fixture.events.length > 0) {
        tx.insert(conventionEvents)
          .values(
            fixture.events.map((event) => ({
              ...event,
              // Sample data must not create reminder intent on app activation.
              reminderMinutes: null,
            })),
          )
          .run();
      }
    }
  });

  return PREVIEW_CONVENTION_ID;
}

export async function resetPreviewConventions(
  isDev: boolean,
  appVariant: unknown,
): Promise<string | null> {
  const fixtures = getPreviewConventionFixtures(isDev, appVariant);
  if (!fixtures) return null;

  db.transaction((tx) => {
    for (const id of [PREVIEW_CONVENTION_ID, BLANK_PREVIEW_CONVENTION_ID]) {
      tx.delete(conventions).where(eq(conventions.id, id)).run();
    }
    for (const fixture of fixtures) {
      tx.insert(conventions).values(fixture.convention).run();
      if (fixture.events.length > 0) {
        tx.insert(conventionEvents).values(fixture.events).run();
      }
    }
  });

  // Only once the rows are actually replaced. Cancelling is irreversible and a
  // rolled-back transaction would otherwise leave the surviving preview rows
  // claiming reminders the OS no longer holds.
  await cancelConventionReminders(
    fixtures.flatMap((fixture) => fixture.events.map((event) => event.id)),
  );

  return PREVIEW_CONVENTION_ID;
}
