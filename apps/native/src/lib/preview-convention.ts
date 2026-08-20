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

export async function resetPreviewConventions(
  isDev: boolean,
  appVariant: unknown,
): Promise<string | null> {
  const fixtures = getPreviewConventionFixtures(isDev, appVariant);
  if (!fixtures) return null;

  await cancelConventionReminders(
    fixtures.flatMap((fixture) => fixture.events.map((event) => event.id)),
  );

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

  return PREVIEW_CONVENTION_ID;
}
