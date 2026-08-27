import { describe, expect, it, vi } from "vitest";
import type { Convention } from "@/db/schema";
import {
  type ConventionDraft,
  commitConventionUpdate,
  commitNewConvention,
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
  name: "IndyFurCon",
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
  const patch = { name: "IndyFurCon 2026" };

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
