import { describe, expect, it } from "vitest";
import {
  agendaStatus,
  buildAgendaRows,
  describeAgendaGap,
  splitMinutes,
} from "./agenda-gaps";

const TZ = "America/New_York";

function at(hour: number, minute = 0, day = 19): string {
  return new Date(Date.UTC(2026, 8, day, hour + 4, minute, 0)).toISOString();
}

function entry(id: string, start: string, end: string | null) {
  return { id, startTime: start, endTime: end };
}

describe("describeAgendaGap", () => {
  it("measures a short break", () => {
    expect(
      describeAgendaGap(
        entry("a", at(14), at(15)),
        entry("b", at(15, 45), at(16)),
      ),
    ).toEqual({ kind: "free", minutes: 45, hint: "short" });
  });

  it("calls an hour or more a long break", () => {
    expect(
      describeAgendaGap(
        entry("a", at(14), at(15)),
        entry("b", at(16, 15), at(17)),
      ),
    ).toEqual({ kind: "free", minutes: 75, hint: "long" });
  });

  it("recognises back-to-back events", () => {
    expect(
      describeAgendaGap(entry("a", at(14), at(15)), entry("b", at(15), at(16))),
    ).toEqual({ kind: "backToBack" });
  });

  it("reports the overlap as the intersection, not the offset", () => {
    // 2:00–3:30 then 2:15–3:15: the second one is wholly inside the first.
    expect(
      describeAgendaGap(
        entry("a", at(14), at(15, 30)),
        entry("b", at(14, 15), at(15, 15)),
      ),
    ).toEqual({ kind: "overlap", minutes: 60 });
  });

  it("gives an overlapping event with no end an hour", () => {
    expect(
      describeAgendaGap(
        entry("a", at(14), at(15)),
        entry("b", at(14, 30), null),
      ),
    ).toEqual({ kind: "overlap", minutes: 30 });
  });

  it("draws nothing after an event whose end is unknown", () => {
    expect(
      describeAgendaGap(entry("a", at(14), null), entry("b", at(16), at(17))),
    ).toBeNull();
  });

  it("draws nothing for an inverted range", () => {
    expect(
      describeAgendaGap(entry("a", at(15), at(14)), entry("b", at(16), at(17))),
    ).toBeNull();
  });
});

describe("splitMinutes", () => {
  it("splits into hours and minutes", () => {
    expect(splitMinutes(75)).toEqual({ hours: 1, minutes: 15 });
    expect(splitMinutes(120)).toEqual({ hours: 2, minutes: 0 });
    expect(splitMinutes(-5)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe("agendaStatus", () => {
  const today = "2026-09-19";

  it("uses half-open intervals", () => {
    const panel = entry("a", at(14), at(15));
    expect(agendaStatus(panel, Date.parse(at(13, 59)), TZ, today)).toBe(
      "upcoming",
    );
    expect(agendaStatus(panel, Date.parse(at(14)), TZ, today)).toBe("now");
    expect(agendaStatus(panel, Date.parse(at(14, 59)), TZ, today)).toBe("now");
    expect(agendaStatus(panel, Date.parse(at(15)), TZ, today)).toBe(
      "endedToday",
    );
  });

  it("separates earlier today from another day", () => {
    const yesterday = entry("y", at(14, 0, 18), at(15, 0, 18));
    expect(agendaStatus(yesterday, Date.parse(at(12)), TZ, today)).toBe(
      "ended",
    );
  });

  it("keeps an event with no end alive for an hour", () => {
    const open = entry("o", at(14), null);
    expect(agendaStatus(open, Date.parse(at(14, 59)), TZ, today)).toBe("now");
    expect(agendaStatus(open, Date.parse(at(15)), TZ, today)).toBe(
      "endedToday",
    );
  });
});

describe("buildAgendaRows", () => {
  const options = {
    nowMs: Date.parse(at(14, 18)),
    timeZone: TZ,
    todayKey: "2026-09-19",
  };

  it("interleaves gap rows with stable ids", () => {
    const rows = buildAgendaRows(
      [
        entry("makers", at(11), at(12)),
        entry("photo", at(14), at(15)),
        entry("draw", at(14, 35), at(15, 30)),
        entry("story", at(16), at(17)),
      ],
      options,
    );
    expect(rows.map((row) => row.id)).toEqual([
      "makers",
      "gap:makers:photo",
      "photo",
      "gap:photo:draw",
      "draw",
      "gap:draw:story",
      "story",
    ]);
    expect(rows[1]).toMatchObject({
      gap: { kind: "free", minutes: 120, hint: "long" },
    });
    expect(rows[3]).toMatchObject({ gap: { kind: "overlap", minutes: 25 } });
    expect(rows[0]).toMatchObject({ status: "endedToday" });
    expect(rows[2]).toMatchObject({ status: "now" });
  });

  it("skips the gap between entries of different groups", () => {
    const rows = buildAgendaRows(
      [
        { ...entry("a", at(14), at(15)), group: "x" },
        { ...entry("b", at(16), at(17)), group: "y" },
      ],
      { ...options, sameGroup: (left, right) => left.group === right.group },
    );
    expect(rows.map((row) => row.kind)).toEqual(["agenda", "agenda"]);
  });
});
