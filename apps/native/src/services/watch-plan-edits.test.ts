import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  getById: vi.fn(),
  getByConventionId: vi.fn(),
  update: vi.fn(),
  reconcile: vi.fn(),
  publish: vi.fn(),
  listener: undefined as
    | ((request: {
        requestId: string;
        conventionId: string;
        eventId: string;
        expectedEndAtMs: number;
        newEndAtMs: number;
      }) => void)
    | undefined,
}));

vi.mock("expo", () => ({
  requireOptionalNativeModule: () => ({
    addListener: (_name: string, listener: typeof mocks.listener) => {
      mocks.listener = listener;
      return { remove: vi.fn() };
    },
    completeWatchLeaveTimeEdit: mocks.complete,
  }),
}));
vi.mock("@/db/repositories/events", () => ({
  getById: mocks.getById,
  getByConventionId: mocks.getByConventionId,
  update: mocks.update,
}));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));
vi.mock("@/services/notifications", () => ({
  reconcileEventReminders: mocks.reconcile,
}));
vi.mock("@/services/widget-snapshot", () => ({
  publishWidgetSnapshot: mocks.publish,
}));

import { setupWatchPlanEdits } from "./watch-plan-edits.ios";

const originalEnd = Date.parse("2026-09-19T14:25:00.000Z");
const request = {
  requestId: "request-1",
  conventionId: "con-1",
  eventId: "event-1",
  expectedEndAtMs: originalEnd,
  newEndAtMs: originalEnd + 300_000,
};
const event = {
  id: request.eventId,
  conventionId: request.conventionId,
  isInSchedule: true,
  feedStatus: null,
  startTime: "2026-09-19T14:00:00.000Z",
  endTime: "2026-09-19T15:00:00.000Z",
  personalStartTime: "2026-09-19T14:00:00.000Z",
  personalEndTime: new Date(originalEnd).toISOString(),
} as ConventionEvent;

describe("Watch leave-time acknowledgement", () => {
  beforeAll(() => setupWatchPlanEdits());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockReset();
    mocks.getById.mockResolvedValueOnce(event).mockResolvedValueOnce({
      ...event,
      personalEndTime: new Date(request.newEndAtMs).toISOString(),
    });
    mocks.update.mockResolvedValue(undefined);
    mocks.getByConventionId.mockResolvedValue([event]);
    mocks.reconcile.mockResolvedValue(undefined);
    mocks.publish.mockResolvedValue(true);
  });

  it("acknowledges only after the write and snapshot publish succeed", async () => {
    mocks.listener?.(request);

    await vi.waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith(request.requestId, true);
    });
    expect(mocks.update).toHaveBeenCalledWith(request.eventId, {
      personalEndTime: new Date(request.newEndAtMs).toISOString(),
    });
    expect(mocks.getById).toHaveBeenCalledTimes(2);
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.publish.mock.invocationCallOrder[0],
    );
    expect(mocks.publish.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.complete.mock.invocationCallOrder[0],
    );
  });

  it("leaves the Watch unsaved when snapshot publishing fails", async () => {
    mocks.publish.mockResolvedValue(false);
    mocks.listener?.({ ...request, requestId: "request-2" });

    await vi.waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith("request-2", false);
    });
    expect(mocks.update).toHaveBeenNthCalledWith(1, request.eventId, {
      personalEndTime: new Date(request.newEndAtMs).toISOString(),
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, request.eventId, {
      personalEndTime: event.personalEndTime,
    });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("does not acknowledge a write that cannot be read back", async () => {
    mocks.getById
      .mockReset()
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(undefined);
    mocks.listener?.({ ...request, requestId: "request-4" });

    await vi.waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith("request-4", false);
    });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("rejects a stale compare-and-set request without writing", async () => {
    mocks.getById.mockReset().mockResolvedValue({
      ...event,
      personalEndTime: "2026-09-19T14:30:00.000Z",
    });
    mocks.listener?.({ ...request, requestId: "request-3" });

    await vi.waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith("request-3", false);
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("rejects an extension that overlaps a future planned event", async () => {
    mocks.getByConventionId.mockResolvedValue([
      event,
      {
        ...event,
        id: "event-2",
        startTime: "2026-09-19T14:28:00.000Z",
        endTime: "2026-09-19T15:30:00.000Z",
        personalStartTime: "2026-09-19T14:28:00.000Z",
        personalEndTime: "2026-09-19T15:00:00.000Z",
      },
    ]);

    mocks.listener?.({ ...request, requestId: "request-conflict" });

    await vi.waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith("request-conflict", false);
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("accepts an extension that ends exactly when the next plan starts", async () => {
    mocks.getByConventionId.mockResolvedValue([
      event,
      {
        ...event,
        id: "event-2",
        startTime: "2026-09-19T14:00:00.000Z",
        endTime: "2026-09-19T15:30:00.000Z",
        personalStartTime: "2026-09-19T14:30:00.000Z",
        personalEndTime: "2026-09-19T15:00:00.000Z",
      },
    ]);

    mocks.listener?.({ ...request, requestId: "request-back-to-back" });

    await vi.waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith("request-back-to-back", true);
    });
    expect(mocks.update).toHaveBeenCalledWith(request.eventId, {
      personalEndTime: new Date(request.newEndAtMs).toISOString(),
    });
  });
});
