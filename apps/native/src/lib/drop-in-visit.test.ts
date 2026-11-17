import { describe, expect, it } from "vitest";
import {
  hasVisit,
  isValidVisit,
  plannedEvent,
  validateDropInVisit,
} from "./drop-in-visit";

const event = {
  startTime: "2026-11-01T04:00:00Z",
  endTime: "2026-11-01T12:00:00Z",
  isInSchedule: true,
  reminderMinutes: 15,
};
describe("personal drop-in visit", () => {
  it("resolves the repeated hour to the earliest candidate that fits opening hours", () => {
    expect(
      validateDropInVisit(
        event,
        { date: "2026-11-01", time: "01:30", durationMinutes: 30 },
        "America/New_York",
      ),
    ).toEqual({
      ok: true,
      startTime: "2026-11-01T05:30:00.000Z",
      endTime: "2026-11-01T06:00:00.000Z",
    });
    expect(
      validateDropInVisit(
        { ...event, startTime: "2026-11-01T06:00:00Z" },
        { date: "2026-11-01", time: "01:30", durationMinutes: 30 },
        "America/New_York",
      ),
    ).toMatchObject({ ok: true, startTime: "2026-11-01T06:30:00.000Z" });
  });
  it("rejects DST gaps, bad dates, invalid zones and visits outside opening hours", () => {
    const spring = {
      ...event,
      startTime: "2026-03-08T05:00:00Z",
      endTime: "2026-03-08T13:00:00Z",
    };
    expect(
      validateDropInVisit(
        spring,
        { date: "2026-03-08", time: "02:30", durationMinutes: 30 },
        "America/New_York",
      ),
    ).toEqual({ ok: false, reason: "time" });
    expect(
      validateDropInVisit(
        event,
        { date: "2026-02-30", time: "01:30", durationMinutes: 30 },
        "UTC",
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateDropInVisit(
        event,
        { date: "2026-11-01", time: "01:30", durationMinutes: 30 },
        "invalid",
      ),
    ).toEqual({ ok: false, reason: "time-zone" });
    expect(
      validateDropInVisit(
        event,
        { date: "2026-11-01", time: "07:45", durationMinutes: 30 },
        "America/New_York",
      ),
    ).toEqual({ ok: false, reason: "window" });
  });
  it("projects one visit without changing feed hours and suppresses invalidated intent", () => {
    const visit = {
      ...event,
      visitStartTime: "2026-11-01T05:30:00.000Z",
      visitEndTime: "2026-11-01T06:00:00.000Z",
    };
    expect(hasVisit(visit)).toBe(true);
    expect(isValidVisit(visit)).toBe(true);
    expect(plannedEvent(visit).startTime).toBe(visit.visitStartTime);
    expect(visit.startTime).toBe(event.startTime);
    const changed = { ...visit, startTime: "2026-11-01T06:00:00Z" };
    expect(plannedEvent(changed)).toMatchObject({
      isInSchedule: false,
      reminderMinutes: null,
      visitStartTime: visit.visitStartTime,
    });
    expect(changed.isInSchedule).toBe(true);
    expect(changed.reminderMinutes).toBe(15);
  });
});

it("keeps projection idempotent without accepting a non-drop-in as its own opening window", () => {
  const visit = {
    ...event,
    visitStartTime: "2026-11-01T05:30:00.000Z",
    visitEndTime: "2026-11-01T06:00:00.000Z",
  };
  expect(plannedEvent(plannedEvent(visit))).toEqual(plannedEvent(visit));
  const timed = {
    ...visit,
    startTime: visit.visitStartTime,
    endTime: visit.visitEndTime,
  };
  expect(plannedEvent(timed).isInSchedule).toBe(false);
});

it("keeps legacy drop-in intent stored while omitting an unplanned opening-hours row", () => {
  expect(plannedEvent(event)).toMatchObject({
    isInSchedule: false,
    reminderMinutes: null,
  });
  expect(event).toMatchObject({ isInSchedule: true, reminderMinutes: 15 });
});
