import type { Convention } from "@/db/schema";
import type { ImportResult } from "@/hooks/useImportSchedule";
import { editionToDraft, sessionsToImport } from "@/lib/catalog/adapter";
import {
  CatalogNotFoundError,
  CatalogUnavailableError,
  catalogScheduleUrl,
} from "@/lib/catalog/client";
import type { CatalogSource } from "@/lib/catalog/source";
import type { CatalogEdition, CatalogSchedule } from "@/lib/catalog/types";
import {
  NetworkError,
  ScheduleFetchCancelledError,
} from "@/lib/sched-extractor";
import { setScheduleAllCategories } from "@/lib/schedule-refresh-storage";
import {
  buildImportedConventionPatch,
  commitScheduleImport,
  deriveImportedConventionDates,
  type ScheduleImportCommitDeps,
} from "@/services/schedule-import-commit";

export interface CatalogDownloadDeps extends ScheduleImportCommitDeps {
  getByCatalogSlug(slug: string): Promise<Convention | undefined>;
}

export type CatalogDownloadResult =
  | {
      ok: true;
      conventionId: string;
      created: boolean;
      result: ImportResult;
    }
  | {
      ok: false;
      reason:
        | "network"
        | "unavailable"
        | "not-found"
        | "import-failed"
        | "cancelled";
    };

export async function downloadCatalogEdition(
  input: {
    edition: CatalogEdition;
    source: CatalogSource;
    signal?: AbortSignal;
  },
  deps: CatalogDownloadDeps,
): Promise<CatalogDownloadResult> {
  const { edition, source, signal } = input;
  if (edition.scheduleStatus === "not-released") {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const schedule: CatalogSchedule =
      edition.sessions.length > 0
        ? {
            version: 1,
            conventionId: edition.id,
            slug: edition.slug,
            revision: edition.revision,
            timezone: edition.timezone,
            status: edition.scheduleStatus,
            sessions: edition.sessions,
          }
        : await source.schedule(edition.slug, signal);
    if (signal?.aborted) throw new ScheduleFetchCancelledError();
    if (
      schedule.slug !== edition.slug ||
      schedule.revision < edition.revision
    ) {
      throw new CatalogUnavailableError(
        "Catalog schedule did not match the edition",
      );
    }

    const currentEdition: CatalogEdition = {
      ...edition,
      revision: schedule.revision,
      scheduleStatus: schedule.status,
      timezone: schedule.timezone,
      sessions: schedule.sessions,
    };
    const scheduleUrl = catalogScheduleUrl(edition.slug);
    const { parsedEvents, sourceSnapshot } = sessionsToImport(currentEdition, {
      scheduleUrl,
    });
    const existing = await deps.getByCatalogSlug(edition.slug);
    const dates = deriveImportedConventionDates(
      parsedEvents,
      currentEdition.timezone,
      new Date(),
    );
    const outcome = await commitScheduleImport(
      {
        conventionId: existing?.id ?? "new",
        draft: existing ? null : editionToDraft(currentEdition),
        parsedEvents,
        sourceSnapshot,
        patch: {
          ...buildImportedConventionPatch({
            dates,
            sourceUrl: null,
            timeZone: currentEdition.timezone,
          }),
          catalogSlug: currentEdition.slug,
          catalogRevision: currentEdition.revision,
          timeZone: currentEdition.timezone,
        },
      },
      deps,
    );
    if (!outcome.ok || (!existing && !outcome.createdConventionId)) {
      return { ok: false, reason: "import-failed" };
    }
    const conventionId = outcome.createdConventionId ?? existing?.id;
    if (!conventionId) return { ok: false, reason: "import-failed" };
    await setScheduleAllCategories(conventionId, true);
    return {
      ok: true,
      conventionId,
      created: !existing,
      result: outcome.result,
    };
  } catch (error) {
    if (error instanceof ScheduleFetchCancelledError || signal?.aborted) {
      return { ok: false, reason: "cancelled" };
    }
    if (error instanceof NetworkError) return { ok: false, reason: "network" };
    if (error instanceof CatalogNotFoundError) {
      return { ok: false, reason: "not-found" };
    }
    if (error instanceof CatalogUnavailableError) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "import-failed" };
  }
}
