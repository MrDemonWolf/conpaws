import assert from "node:assert/strict";
import { attendancePanel, commitChoice, gap, getConflicts, overlapMinutes, panels, parseTimeInput, timeRange, validateAttendance, type Attendance, type Panel } from "./app";
import { liveActivitySamples, liveAlertScenarios } from "./live-alerts";

const sample = (id: string, start: number, end: number, extra: Partial<Panel> = {}): Panel => ({
  ...panels[0], id, start, end, ...extra,
});
const a = sample("test-a", 840, 900);
const b = sample("test-b", 870, 930);
const c = sample("test-c", 900, 960);
const tomorrow = sample("test-tomorrow", 840, 900, { day: a.day + 1 });
const dropIn = sample("test-drop-in", 600, 1080, { dropIn: true });
const unrelated = sample("test-unrelated", 1020, 1080);
const samples = [a, b, c, tomorrow, dropIn, unrelated];
const originalLength = panels.length;

panels.push(...samples);
try {
  assert.equal(overlapMinutes(a, b), 30, "partial overlap uses the actual intersection");
  assert.equal(overlapMinutes(b, a), 30, "overlap is symmetric");
  assert.equal(overlapMinutes(a, c), 0, "back-to-back panels do not overlap");
  assert.equal(overlapMinutes(a, tomorrow), 0, "same clock times on distinct days do not overlap");
  assert.equal(overlapMinutes(a, dropIn), 0, "drop-ins do not block time");
  assert.equal(overlapMinutes(dropIn, a), 0, "drop-in exclusion is symmetric");
  const longPanel = sample("test-long", 840, 930);
  const contained = sample("test-contained", 855, 915);
  assert.equal(overlapMinutes(longPanel, contained), 60, "contained overlaps cannot exceed the shorter panel's duration");
  assert.match(gap(longPanel, contained), /60 min overlap/, "gap copy reports the actual overlap, not 75 minutes until the longer panel ends");
  assert.equal(timeRange(sample("test-noon", 660, 720)), "11:00 AM–12:00 PM", "cross-noon ranges label both endpoints");
  assert.equal(timeRange(a), "2:00–3:00 PM", "same-period ranges keep one unambiguous period label");

  const plan = new Set(samples.map(item => item.id));
  assert.deepEqual(getConflicts(a, plan).map(item => item.id), [b.id], "A conflicts only with B, not C through B");
  assert.deepEqual(getConflicts(b, plan).map(item => item.id), [a.id, c.id], "B directly conflicts with both A and C");
  assert.deepEqual(getConflicts(c, plan).map(item => item.id), [b.id], "C conflicts only with B");
  assert.deepEqual(getConflicts(a, new Set([a.id])), [], "a planned panel never conflicts with itself");
  assert.deepEqual(getConflicts(dropIn, plan), [], "drop-ins never create plan conflicts");

  const before = new Set([b.id, c.id, tomorrow.id, dropIn.id, unrelated.id]);
  assert.deepEqual(
    commitChoice(a, before),
    new Set([a.id, c.id, tomorrow.id, dropIn.id, unrelated.id]),
    "replacement removes direct overlaps and preserves unrelated planned panels",
  );
  assert.deepEqual(
    commitChoice(a, before, true),
    new Set([...before, a.id]),
    "keepBoth preserves every planned panel while adding the candidate",
  );
  assert.deepEqual(before, new Set([b.id, c.id, tomorrow.id, dropIn.id, unrelated.id]), "committing never mutates the original plan");
  assert.deepEqual(commitChoice(b, new Set([a.id, c.id, unrelated.id])), new Set([b.id, unrelated.id]), "replacement removes every direct overlap");
  assert.deepEqual(commitChoice(dropIn, before), before, "adding an already-saved drop-in removes no panels");
  assert.deepEqual(commitChoice(a, new Set([a.id, unrelated.id])), new Set([a.id, unrelated.id]), "keeping an existing choice is idempotent");

  assert.equal(parseTimeInput("00:00"), 0, "midnight is a valid time");
  assert.equal(parseTimeInput("14:25"), 865, "time input becomes minutes after midnight");
  assert.equal(parseTimeInput("23:59"), 1439, "the final minute of the day is valid");
  const invalidTimes = ["", "2:25", "24:00", "14:60", "-1:00", "aa:bb", "14:25:00", " 14:25", "14:25\n"];
  for (const value of invalidTimes) {
    assert.ok(Number.isNaN(parseTimeInput(value)), `invalid time ${JSON.stringify(value)} is rejected`);
  }

  const photography = panels.find(item => item.id === "photo")!;
  const drawing = panels.find(item => item.id === "draw")!;
  const published = [{ ...photography }, { ...drawing }];
  const partialTimes = { photo: { join: 840, leave: 865 }, draw: { join: 875, leave: 920 } };
  const partialPlan = new Set(["photo", "draw"]);
  assert.equal(validateAttendance(photography, partialTimes.photo), null, "photography permits attending 2:00–2:25 PM");
  assert.equal(validateAttendance(drawing, partialTimes.draw), null, "drawing permits joining late at 2:35 and leaving at 3:20 PM");
  assert.equal(validateAttendance(photography, { join: photography.start, leave: photography.end }), null, "full published attendance remains valid");
  const invalidAttendance: Attendance[] = [
    { join: 839, leave: 865 }, { join: 840, leave: 901 },
    { join: 865, leave: 865 }, { join: 875, leave: 865 },
    { join: NaN, leave: 865 }, { join: 840, leave: Infinity },
    { join: 840.5, leave: 865 }, { join: 840, leave: 865.5 },
  ];
  for (const value of invalidAttendance) {
    assert.equal(typeof validateAttendance(photography, value), "string", "outside-published, empty, reversed, and noninteger attendance is rejected");
  }
  assert.deepEqual(attendancePanel(photography, partialTimes), { ...photography, start: 840, end: 865 }, "attendance projects personal times without changing event metadata");
  assert.strictEqual(attendancePanel(photography), photography, "no personal times falls back to the published panel");
  assert.strictEqual(attendancePanel(photography, { photo: { join: 840, leave: 901 } }), photography, "invalid personal times cannot mask the published overlap");
  assert.deepEqual(getConflicts(photography, partialPlan).map(item => item.id), ["draw"], "published photography and drawing times overlap");
  assert.deepEqual(getConflicts(photography, partialPlan, partialTimes), [], "separate partial attendance resolves the published overlap");
  assert.deepEqual(getConflicts(drawing, partialPlan, partialTimes), [], "partial attendance conflict resolution is symmetric");
  const overlappingTimes = { ...partialTimes, draw: { join: 860, leave: 920 } };
  assert.deepEqual(getConflicts(photography, partialPlan, overlappingTimes).map(item => item.id), ["draw"], "overlapping partial attendance remains a conflict");
  assert.equal(overlapMinutes(attendancePanel(photography, overlappingTimes), attendancePanel(drawing, overlappingTimes)), 5, "partial attendance measures the five-minute intersection");
  assert.deepEqual(getConflicts(photography, partialPlan, { ...partialTimes, draw: { join: 865, leave: 920 } }), [], "back-to-back personal attendance is allowed");
  assert.deepEqual(commitChoice(photography, partialPlan, false, partialTimes), partialPlan, "choosing a panel preserves compatible partial attendance");
  assert.deepEqual(commitChoice(photography, partialPlan, false, overlappingTimes), new Set(["photo"]), "choice replacement uses personal attendance conflicts");
  assert.deepEqual([photography, drawing], published, "attendance validation, projection, and conflict checks never modify published panel times");
  assert.deepEqual(partialTimes, { photo: { join: 840, leave: 865 }, draw: { join: 875, leave: 920 } }, "conflict checks never modify the saved attendance times");

  assert.deepEqual(Object.keys(liveActivitySamples), ["upcoming", "current", "leave", "finished"], "all four Live Activity lifecycle states have previews");
  assert.equal(liveActivitySamples.current.clock, "2:18", "current Live Activity uses the prototype's 2:18 PM clock");
  assert.equal(liveActivitySamples.current.value, String(parseTimeInput("14:25") - parseTimeInput("14:18")), "countdown uses the seven minutes until the user's leave time");
  assert.equal(liveActivitySamples.current.progress, (18 / 25) * 100, "progress follows personal attendance rather than the full panel");
  assert.equal(liveActivitySamples.leave.clock, "2:25", "leave-now preview advances the clock to the saved leave time");
  assert.equal(liveActivitySamples.leave.value, "Now", "leave-now wording appears in the due state");
  assert.match(liveActivitySamples.finished.instruction, /continues until 3:30 PM/, "finishing personal attendance does not imply the panel ended");
  assert.deepEqual(Object.keys(liveAlertScenarios), ["upcoming", "leave", "joining", "moved", "cancelled", "overlap", "test"], "copy playground includes every requested notification situation and a test");
  for (const scenario of Object.values(liveAlertScenarios)) {
    for (const tone of ["short", "friendly"] as const) {
      assert.ok(scenario[tone].title.length > 0 && scenario[tone].title.length <= 30, "both copy tones keep a short, nonempty notification title");
      assert.ok(scenario[tone].body.trim().length > 0, "both copy tones include useful message content");
    }
  }
  assert.doesNotMatch(liveAlertScenarios.upcoming.short.title, /leave/i, "an organizer start reminder does not invent a personal leave time");
  assert.equal(liveAlertScenarios.leave.clock, "2:25 PM", "leave notification example is due at the user's saved time");
  assert.match(liveAlertScenarios.joining.short.body, /2:35 PM.*2:00 PM/, "late-join copy distinguishes personal and published starts");
  assert.match(liveAlertScenarios.moved.short.body, /Cedar to Maple.*still 2:35 PM/, "room-change copy preserves the chosen attendance time");
  assert.match(liveAlertScenarios.cancelled.short.body, /organizer cancelled.*Review/, "cancellation identifies the source and asks the user to review");
  assert.match(liveAlertScenarios.overlap.short.body, /keep both as options/, "overlap copy permits multiple candidates instead of forcing replacement");
  assert.match(liveAlertScenarios.test.context, /does not request permission or send notifications/, "notification testing is explicitly a browser-only preview");
  console.log("Passed: existing overlap/choice checks; attendance parsing, validation, conflict resolution and immutable source data; Live Activity timing; notification scenarios and both copy tones.");
} finally {
  panels.splice(originalLength, samples.length);
}
