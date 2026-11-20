import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));

import type { Convention } from "@/db/schema";
import {
  type ConventionCommitOutcome,
  type ConventionDraft,
  commitConventionUpdate,
  commitNewConvention,
  saveConventionEdit,
} from "./convention-commit";

/**
 * These replace a source lint that read the create and edit routes and checked
 * that `publishWidgetSnapshot` appeared after the database write. The sequence
 * lives in plain async functions now, so the ordering is asserted rather than
 * inferred from where the calls happen to sit in a file.
 *
 * The ordering the routes themselves still own -- navigating only after the
 * commit -- is guaranteed by the `await`: these functions resolve after the
 * snapshot is published, so a caller cannot navigate any earlier.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const draft: ConventionDraft = {
  name: "Example Con",
  startDate: "2026-08-21",
  endDate: "2026-08-23",
  timeZone: "America/Indiana/Indianapolis",
  location: "Indianapolis",
  icalUrl: null,
  status: "upcoming",
};

function conventionRow(id = "conv_1"): Convention {
  return {
    id,
    name: draft.name,
    startDate: draft.startDate,
    endDate: draft.endDate,
    timeZone: draft.timeZone ?? null,
    location: draft.location ?? null,
    archivedAt: null,
    icalUrl: null,
    catalogSlug: null,
    catalogRevision: null,
    status: "upcoming",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function newConventionDeps(
  create: () => Promise<Convention> = async () => conventionRow(),
) {
  return {
    create: vi.fn(create),
    seedCaches: vi.fn(),
    invalidateList: vi.fn(async () => undefined),
    publishSnapshot: vi.fn(async () => true),
    haptic: vi.fn(),
  };
}

function updateDeps(update: () => Promise<void> = async () => undefined) {
  return {
    update: vi.fn(update),
    refreshCaches: vi.fn(async () => undefined),
    publishSnapshot: vi.fn(async () => true),
    haptic: vi.fn(),
  };
}

/** First invocation index of a mock, for cross-mock ordering comparisons. */
function firstCall(mock: { mock: { invocationCallOrder: number[] } }): number {
  const [order] = mock.mock.invocationCallOrder;
  expect(order).toBeDefined();
  return order as number;
}

describe("commitNewConvention", () => {
  it("seeds the caches and publishes the snapshot after the insert", async () => {
    const deps = newConventionDeps();

    const outcome = await commitNewConvention(draft, deps);

    expect(outcome).toEqual({ ok: true, conventionId: "conv_1" });
    expect(deps.create).toHaveBeenCalledWith(draft);
    expect(firstCall(deps.seedCaches)).toBeGreaterThan(firstCall(deps.create));
    expect(firstCall(deps.invalidateList)).toBeGreaterThan(
      firstCall(deps.seedCaches),
    );
    expect(firstCall(deps.publishSnapshot)).toBeGreaterThan(
      firstCall(deps.invalidateList),
    );
    expect(deps.seedCaches).toHaveBeenCalledWith(conventionRow());
  });

  it("does not publish a snapshot while the insert is still in flight", async () => {
    // Ordering by call index alone would pass even if the publish were fired
    // off in parallel with the write. The widget builds its snapshot by
    // reading the database, so what matters is that the row is there first.
    const gate = deferred<Convention>();
    const deps = newConventionDeps(() => gate.promise);

    const pending = commitNewConvention(draft, deps);
    await Promise.resolve();
    expect(deps.seedCaches).not.toHaveBeenCalled();
    expect(deps.publishSnapshot).not.toHaveBeenCalled();

    gate.resolve(conventionRow());
    await pending;
    expect(deps.publishSnapshot).toHaveBeenCalledTimes(1);
  });

  it("reports a failed insert without touching anything downstream", async () => {
    const deps = newConventionDeps(async () => {
      throw new Error("disk is full");
    });

    const outcome = await commitNewConvention(draft, deps);

    expect(outcome).toEqual({ ok: false, reason: "write-failed" });
    expect(deps.seedCaches).not.toHaveBeenCalled();
    expect(deps.invalidateList).not.toHaveBeenCalled();
    expect(deps.publishSnapshot).not.toHaveBeenCalled();
    expect(deps.haptic).not.toHaveBeenCalled();
  });

  it("still reports success when the snapshot cannot be published", async () => {
    // The convention exists; refusing to navigate to it because a widget
    // extension is unavailable would strand the user on a spent form.
    const deps = newConventionDeps();
    deps.publishSnapshot.mockRejectedValueOnce(new Error("no app group"));

    await expect(commitNewConvention(draft, deps)).resolves.toEqual({
      ok: true,
      conventionId: "conv_1",
    });
  });
});

describe("commitConventionUpdate", () => {
  const patch = { name: "Example Con 2026" };

  it("publishes the snapshot after the row is rewritten", async () => {
    const deps = updateDeps();

    const outcome = await commitConventionUpdate("conv_1", patch, deps);

    expect(outcome).toEqual({ ok: true, conventionId: "conv_1" });
    expect(deps.update).toHaveBeenCalledWith("conv_1", patch);
    expect(firstCall(deps.refreshCaches)).toBeGreaterThan(
      firstCall(deps.update),
    );
    expect(firstCall(deps.publishSnapshot)).toBeGreaterThan(
      firstCall(deps.refreshCaches),
    );
    expect(deps.refreshCaches).toHaveBeenCalledWith("conv_1");
  });

  it("does not publish a snapshot while the update is still in flight", async () => {
    const gate = deferred<void>();
    const deps = updateDeps(() => gate.promise);

    const pending = commitConventionUpdate("conv_1", patch, deps);
    await Promise.resolve();
    expect(deps.publishSnapshot).not.toHaveBeenCalled();

    gate.resolve();
    await pending;
    expect(deps.publishSnapshot).toHaveBeenCalledTimes(1);
  });

  it("reports a failed update without republishing the old row", async () => {
    const deps = updateDeps(async () => {
      throw new Error("locked");
    });

    const outcome = await commitConventionUpdate("conv_1", patch, deps);

    expect(outcome).toEqual({ ok: false, reason: "write-failed" });
    expect(deps.refreshCaches).not.toHaveBeenCalled();
    expect(deps.publishSnapshot).not.toHaveBeenCalled();
    expect(deps.haptic).not.toHaveBeenCalled();
  });

  it("still reports success when the snapshot cannot be published", async () => {
    const deps = updateDeps();
    deps.publishSnapshot.mockRejectedValueOnce(new Error("no app group"));

    await expect(
      commitConventionUpdate("conv_1", patch, deps),
    ).resolves.toEqual({ ok: true, conventionId: "conv_1" });
  });
});

describe("saveConventionEdit", () => {
  // The edit form resolves a changed location's zone before it writes. That
  // geocode can take seconds, and the form used to stay live across it: a
  // second Save wrote twice and popped the convention screen as well, and a
  // Cancel -> Discard still wrote the discarded edit once the geocode landed.

  function editSteps(
    overrides: {
      resolveTimeZone?: () => Promise<string | null>;
      commit?: (timeZone: string) => Promise<ConventionCommitOutcome | null>;
      isMounted?: () => boolean;
    } = {},
  ) {
    return {
      resolveTimeZone: vi.fn(
        overrides.resolveTimeZone ?? (async () => "America/New_York"),
      ),
      commit: vi.fn(
        overrides.commit ??
          (async (): Promise<ConventionCommitOutcome | null> => ({
            ok: true,
            conventionId: "conv_1",
          })),
      ),
      isMounted: vi.fn(overrides.isMounted ?? (() => true)),
      setSaving: vi.fn(),
      onWriteFailed: vi.fn(),
      leave: vi.fn(),
    };
  }

  it("locks the form before the time zone is resolved", async () => {
    const zone = deferred<string | null>();
    const steps = editSteps({ resolveTimeZone: () => zone.promise });

    const pending = saveConventionEdit({ current: false }, steps);
    expect(steps.setSaving).toHaveBeenCalledWith(true);
    expect(firstCall(steps.setSaving)).toBeLessThan(
      firstCall(steps.resolveTimeZone),
    );

    zone.resolve("America/New_York");
    await pending;
  });

  it("writes and leaves once when Save is tapped again mid-geocode", async () => {
    const zone = deferred<string | null>();
    const lock = { current: false };
    const steps = editSteps({ resolveTimeZone: () => zone.promise });

    const first = saveConventionEdit(lock, steps);
    const second = saveConventionEdit(lock, steps);
    zone.resolve("America/New_York");
    await Promise.all([first, second]);

    expect(steps.resolveTimeZone).toHaveBeenCalledTimes(1);
    expect(steps.commit).toHaveBeenCalledTimes(1);
    expect(steps.commit).toHaveBeenCalledWith("America/New_York");
    expect(steps.leave).toHaveBeenCalledTimes(1);
  });

  it("writes nothing once the form closed during the geocode", async () => {
    const zone = deferred<string | null>();
    let mounted = true;
    const steps = editSteps({
      resolveTimeZone: () => zone.promise,
      isMounted: () => mounted,
    });

    const pending = saveConventionEdit({ current: false }, steps);
    mounted = false;
    zone.resolve("America/New_York");
    await pending;

    expect(steps.commit).not.toHaveBeenCalled();
    expect(steps.leave).not.toHaveBeenCalled();
  });

  it("does not navigate again when the form closed during the write", async () => {
    // A second back() after the sheet has gone pops the convention screen.
    const write = deferred<ConventionCommitOutcome | null>();
    let mounted = true;
    const steps = editSteps({
      commit: () => write.promise,
      isMounted: () => mounted,
    });

    const pending = saveConventionEdit({ current: false }, steps);
    await vi.waitFor(() => expect(steps.commit).toHaveBeenCalled());
    mounted = false;
    write.resolve({ ok: true, conventionId: "conv_1" });
    await pending;

    expect(steps.leave).not.toHaveBeenCalled();
  });

  it("unlocks the form when the user goes to pick a zone instead", async () => {
    const lock = { current: false };
    const steps = editSteps({ resolveTimeZone: async () => null });

    await saveConventionEdit(lock, steps);

    expect(lock.current).toBe(false);
    expect(steps.setSaving).toHaveBeenLastCalledWith(false);
    expect(steps.commit).not.toHaveBeenCalled();
    expect(steps.leave).not.toHaveBeenCalled();
  });

  it("unlocks the form when the values no longer validate", async () => {
    const lock = { current: false };
    const steps = editSteps({ commit: async () => null });

    await saveConventionEdit(lock, steps);

    expect(lock.current).toBe(false);
    expect(steps.setSaving).toHaveBeenLastCalledWith(false);
    expect(steps.leave).not.toHaveBeenCalled();
  });

  it("reports a failed write and stays on the form", async () => {
    const lock = { current: false };
    const steps = editSteps({
      commit: async () => ({ ok: false, reason: "write-failed" }),
    });

    await saveConventionEdit(lock, steps);

    expect(steps.onWriteFailed).toHaveBeenCalledTimes(1);
    expect(lock.current).toBe(false);
    expect(steps.setSaving).toHaveBeenLastCalledWith(false);
    expect(steps.leave).not.toHaveBeenCalled();
  });
});
