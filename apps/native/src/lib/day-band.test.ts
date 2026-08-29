import { describe, expect, it } from "vitest";
import { overlapInfo, overlapInfoAmong } from "./day-band";

describe("overlapInfo", () => {
  it("groups mutually overlapping events with positions and exact counts", () => {
    // A 22:00-23:00, B 22:00-23:00, C 22:30-00:00 — the motivating case: all
    // three must read as one group.
    expect(
      overlapInfo([
        { startTime: "2026-09-03T22:00:00Z", endTime: "2026-09-03T23:00:00Z" },
        { startTime: "2026-09-03T22:00:00Z", endTime: "2026-09-03T23:00:00Z" },
        { startTime: "2026-09-03T22:30:00Z", endTime: "2026-09-04T00:00:00Z" },
      ]),
    ).toEqual([
      { position: "first", clusterSize: 3, overlapCount: 2 },
      { position: "middle", clusterSize: 3, overlapCount: 2 },
      { position: "last", clusterSize: 3, overlapCount: 2 },
    ]);
  });

  it("chains a cluster through a bridging event but keeps counts exact", () => {
    // A 19:00-20:00 and C 20:30-21:00 never overlap — they share a cluster
    // only through B, so each counts only B.
    expect(
      overlapInfo([
        { startTime: "2026-09-03T19:00:00Z", endTime: "2026-09-03T20:00:00Z" },
        { startTime: "2026-09-03T19:00:00Z", endTime: "2026-09-03T22:00:00Z" },
        { startTime: "2026-09-03T20:30:00Z", endTime: "2026-09-03T21:00:00Z" },
      ]),
    ).toEqual([
      { position: "first", clusterSize: 3, overlapCount: 1 },
      { position: "middle", clusterSize: 3, overlapCount: 2 },
      { position: "last", clusterSize: 3, overlapCount: 1 },
    ]);
  });

  it("splits a new cluster when an event starts exactly as the block ends", () => {
    expect(
      overlapInfo([
        { startTime: "2026-09-03T19:00:00Z", endTime: "2026-09-03T20:00:00Z" },
        { startTime: "2026-09-03T20:00:00Z", endTime: "2026-09-03T21:00:00Z" },
        { startTime: "2026-09-03T20:30:00Z", endTime: "2026-09-03T21:30:00Z" },
      ]),
    ).toEqual([
      { position: "solo", clusterSize: 1, overlapCount: 0 },
      { position: "first", clusterSize: 2, overlapCount: 1 },
      { position: "last", clusterSize: 2, overlapCount: 1 },
    ]);
  });

  it("marks non-overlapping events solo", () => {
    expect(
      overlapInfo([
        { startTime: "2026-09-03T19:00:00Z", endTime: "2026-09-03T20:00:00Z" },
        { startTime: "2026-09-03T20:00:00Z", endTime: "2026-09-03T21:00:00Z" },
      ]),
    ).toEqual([
      { position: "solo", clusterSize: 1, overlapCount: 0 },
      { position: "solo", clusterSize: 1, overlapCount: 0 },
    ]);
  });

  it("treats a missing end time as one hour", () => {
    expect(
      overlapInfo([
        { startTime: "2026-09-03T19:00:00Z", endTime: null },
        { startTime: "2026-09-03T19:30:00Z", endTime: null }, // inside the hour
        { startTime: "2026-09-03T21:00:00Z", endTime: null }, // after it
      ]),
    ).toEqual([
      { position: "first", clusterSize: 2, overlapCount: 1 },
      { position: "last", clusterSize: 2, overlapCount: 1 },
      { position: "solo", clusterSize: 1, overlapCount: 0 },
    ]);
  });

  it("handles an empty day", () => {
    expect(overlapInfo([])).toEqual([]);
  });
});

describe("overlapInfoAmong", () => {
  const at = (h: number, m = 0) =>
    `2026-09-03T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

  it("groups only included events; excluded rows stay solo even when they overlap", () => {
    // Starred A 22:00-23:00 and C 22:30-00:00 group; unstarred B sits between
    // them, overlaps both, and must not join or split the group.
    const events = [
      { startTime: at(22), endTime: at(23), starred: true },
      { startTime: at(22), endTime: at(23), starred: false },
      { startTime: at(22, 30), endTime: "2026-09-04T00:00:00Z", starred: true },
    ];
    expect(overlapInfoAmong(events, (event) => event.starred)).toEqual([
      { position: "first", clusterSize: 2, overlapCount: 1 },
      { position: "solo", clusterSize: 1, overlapCount: 0 },
      { position: "last", clusterSize: 2, overlapCount: 1 },
    ]);
  });

  it("keeps included events solo when only excluded events overlap them", () => {
    const events = [
      { startTime: at(19), endTime: at(20), starred: true },
      { startTime: at(19), endTime: at(20), starred: false },
    ];
    expect(overlapInfoAmong(events, (event) => event.starred)).toEqual([
      { position: "solo", clusterSize: 1, overlapCount: 0 },
      { position: "solo", clusterSize: 1, overlapCount: 0 },
    ]);
  });

  it("does not bridge included events through an excluded long event", () => {
    // Unstarred 19:00-23:00 spans both starred events; starred pair still
    // reads as two solo rows because they never overlap each other.
    const events = [
      { startTime: at(19), endTime: at(23), starred: false },
      { startTime: at(19, 30), endTime: at(20), starred: true },
      { startTime: at(21), endTime: at(22), starred: true },
    ];
    expect(overlapInfoAmong(events, (event) => event.starred)).toEqual([
      { position: "solo", clusterSize: 1, overlapCount: 0 },
      { position: "solo", clusterSize: 1, overlapCount: 0 },
      { position: "solo", clusterSize: 1, overlapCount: 0 },
    ]);
  });
});
