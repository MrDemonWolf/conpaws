import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Convention } from "@/db/schema";
import {
  CatalogNotFoundError,
  CatalogUnavailableError,
} from "@/lib/catalog/client";
import type { CatalogEdition, CatalogSchedule } from "@/lib/catalog/types";
import {
  NetworkError,
  ScheduleFetchCancelledError,
} from "@/lib/sched-extractor";
import {
  type CatalogDownloadDeps,
  downloadCatalogEdition,
} from "./catalog-download";

const { setScheduleAllCategories } = vi.hoisted(() => ({
  setScheduleAllCategories: vi.fn(),
}));

vi.mock("@/lib/schedule-refresh-storage", () => ({
  setScheduleAllCategories,
}));
vi.mock("@/lib/catalog/client", () => ({
  CatalogNotFoundError: class CatalogNotFoundError extends Error {},
  CatalogUnavailableError: class CatalogUnavailableError extends Error {},
  catalogScheduleUrl: (slug: string) => `https://catalog.test/${slug}/schedule`,
}));
vi.mock("@/lib/sched-extractor", () => ({
  NetworkError: class NetworkError extends Error {},
  ScheduleFetchCancelledError: class ScheduleFetchCancelledError extends Error {},
}));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));

const edition: CatalogEdition = {
  id: "edition-1",
  slug: "sample-con",
  name: "Sample Con",
  acronym: "SC",
  city: "Sample Harbor",
  region: "Sample Region",
  country: "Sample Country",
  startsOn: "2026-10-20",
  endsOn: "2026-10-22",
  timezone: "America/New_York",
  venue: "Sample Hall",
  availability: "unknown",
  scheduleStatus: "complete",
  revision: 2,
  sessions: [
    {
      id: "panel-1",
      title: "Opening panel",
      description: "",
      room: "Main Hall",
      startsAt: "2026-10-20T10:00",
      endsAt: "2026-10-20T11:00",
      status: "scheduled",
    },
  ],
};

function harness() {
  const conventions = new Map<string, Convention>();
  const calls = {
    create: vi.fn(async (draft: { catalogSlug?: string | null }) => {
      const record = {
        id: `local-${conventions.size + 1}`,
        catalogSlug: draft.catalogSlug ?? null,
      } as Convention;
      conventions.set(record.catalogSlug ?? "", record);
      return record;
    }),
    importEvents: vi.fn(async () => ({
      added: 1,
      updated: 0,
      unresolved: 0,
      removed: 0,
      tombstoned: 0,
      remindersCleared: 0,
      remindersPaused: 0,
    })),
    update: vi.fn(async (id: string, patch: Partial<Convention>) => {
      const current = [...conventions.values()].find((row) => row.id === id);
      if (current)
        conventions.set(current.catalogSlug ?? "", { ...current, ...patch });
    }),
    remove: vi.fn(async (id: string) => {
      for (const [slug, record] of conventions) {
        if (record.id === id) conventions.delete(slug);
      }
    }),
    publishSnapshot: vi.fn(async () => true),
    refreshCaches: vi.fn(async () => undefined),
    haptic: vi.fn(),
  };
  const deps: CatalogDownloadDeps = {
    getByCatalogSlug: async (slug) => conventions.get(slug),
    createConvention: calls.create,
    importEvents: calls.importEvents,
    updateConvention: calls.update,
    removeConvention: calls.remove,
    publishSnapshot: calls.publishSnapshot,
    refreshCaches: calls.refreshCaches,
    haptic: calls.haptic,
  };
  return { deps, calls, conventions };
}

const schedule: CatalogSchedule = {
  version: 1,
  conventionId: edition.id,
  slug: edition.slug,
  revision: edition.revision,
  timezone: edition.timezone,
  status: edition.scheduleStatus,
  sessions: edition.sessions,
};

beforeEach(() => {
  vi.clearAllMocks();
  setScheduleAllCategories.mockResolvedValue(undefined);
});

describe("downloadCatalogEdition", () => {
  it("creates once, then updates the existing convention by catalog slug", async () => {
    const { deps, calls, conventions } = harness();
    const source = {
      kind: "fixture" as const,
      list: async () => [edition],
      schedule: vi.fn(async () => schedule),
    };

    const first = await downloadCatalogEdition({ edition, source }, deps);
    const second = await downloadCatalogEdition({ edition, source }, deps);

    expect(first).toMatchObject({
      ok: true,
      conventionId: "local-1",
      created: true,
    });
    expect(second).toMatchObject({
      ok: true,
      conventionId: "local-1",
      created: false,
    });
    expect(conventions.size).toBe(1);
    expect(calls.create).toHaveBeenCalledTimes(1);
    expect(calls.importEvents).toHaveBeenCalledTimes(2);
    expect(calls.update).toHaveBeenCalledWith(
      "local-1",
      expect.objectContaining({
        catalogSlug: edition.slug,
        catalogRevision: 2,
      }),
    );
    expect(setScheduleAllCategories).toHaveBeenCalledWith("local-1", true);
    expect(source.schedule).not.toHaveBeenCalled();
  });

  it.each([
    ["network", new NetworkError("offline")],
    ["not-found", new CatalogNotFoundError()],
    ["unavailable", new CatalogUnavailableError()],
    ["cancelled", new ScheduleFetchCancelledError()],
  ] as const)("maps %s download errors", async (reason, error) => {
    const { deps } = harness();
    const source = {
      kind: "http" as const,
      list: async () => [edition],
      schedule: async () => {
        throw error;
      },
    };
    const result = await downloadCatalogEdition(
      { edition: { ...edition, sessions: [] }, source },
      deps,
    );
    expect(result).toEqual({ ok: false, reason });
  });

  it("does not import when the schedule is not released or the write fails", async () => {
    const { deps, calls } = harness();
    const notReleased = await downloadCatalogEdition(
      {
        edition: { ...edition, scheduleStatus: "not-released", sessions: [] },
        source: {
          kind: "fixture",
          list: async () => [],
          schedule: async () => schedule,
        },
      },
      deps,
    );
    expect(notReleased).toEqual({ ok: false, reason: "unavailable" });
    expect(calls.importEvents).not.toHaveBeenCalled();

    calls.importEvents.mockRejectedValue(new Error("write failed"));
    const failed = await downloadCatalogEdition(
      {
        edition,
        source: {
          kind: "fixture",
          list: async () => [],
          schedule: async () => schedule,
        },
      },
      deps,
    );
    expect(failed).toEqual({ ok: false, reason: "import-failed" });
    expect(calls.create).toHaveBeenCalledTimes(1);
    expect(calls.remove).toHaveBeenCalledWith("local-1");
  });
});
