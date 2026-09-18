import { mountEmptyStates } from "./empty-states";
import { mountLiveAlerts } from "./live-alerts";
import { mountWatch } from "./watch";
import { mountWidgets } from "./widgets";

export type Panel = {
  id: string;
  title: string;
  start: number;
  end: number;
  room: string;
  level: string;
  category: string;
  color: string;
  host: string;
  description: string;
  short: string;
  day: number;
  dropIn?: boolean;
};
const p = (
  id: string,
  title: string,
  start: number,
  end: number,
  room: string,
  category: string,
  color: string,
  short: string,
  day = 19,
): Panel => ({
  id,
  title,
  start,
  end,
  room,
  category,
  color,
  short,
  day,
  level: room.includes("Ballroom") ? "Level 2" : "Level 1",
  host:
    (
      {
        Fursuiting: "River & Ash",
        Art: "Milo the Fox",
        Community: "Lakeside community team",
        Games: "Maple & friends",
        Writing: "Juniper",
        Performance: "Echo",
      } as Record<string, string>
    )[category] ?? "Lakeside team",
  description: `${short} Join a welcoming, hands-on session with fellow con-goers. Bring your curiosity; no previous experience is needed. There will be time for questions at the end. All ages welcome.`,
});
export const panels: Panel[] = [
  p(
    "photo",
    "Fursuit photography",
    840,
    900,
    "Ballroom A",
    "Fursuiting",
    "#ac722b",
    "Find your light. Get better photos, in or out of suit.",
  ),
  p(
    "draw",
    "Character design lab",
    840,
    930,
    "Cedar",
    "Art",
    "#8b6fc0",
    "Give your character a little more character. Sketch along with Milo.",
  ),
  p(
    "first",
    "Your first fursuit",
    870,
    930,
    "Maple",
    "Fursuiting",
    "#ac722b",
    "A friendly guide to finding, fitting, and caring for your first suit.",
  ),
  p(
    "meet",
    "Find your local pack",
    840,
    900,
    "Birch",
    "Community",
    "#398c87",
    "Meet nearby furs and find your next local meetup.",
  ),
  p(
    "games",
    "Board game social",
    840,
    900,
    "Game Lounge",
    "Games",
    "#587db0",
    "Pull up a chair. We will teach you the rules.",
  ),
  p(
    "write",
    "Worldbuilding together",
    840,
    900,
    "Willow",
    "Writing",
    "#a97491",
    "Create a world your characters will want to call home.",
  ),
  p(
    "dance",
    "Dance, paws & all",
    855,
    915,
    "Ballroom B",
    "Performance",
    "#b3676f",
    "Easy moves and good music. Every body is a dancing body.",
  ),
  p(
    "craft",
    "Paw-friendly prop making",
    840,
    900,
    "Oak",
    "Art",
    "#8b6fc0",
    "Build a lightweight prop with simple materials.",
  ),
  p(
    "voice",
    "Find your character voice",
    840,
    900,
    "Aspen",
    "Performance",
    "#b3676f",
    "Try voice acting in a relaxed small-group workshop.",
  ),
  p(
    "care",
    "Fursuit care clinic",
    840,
    900,
    "Spruce",
    "Fursuiting",
    "#ac722b",
    "Small repairs, cleaning tips, and a fresh start for your suit.",
  ),
  p(
    "makers",
    "Meet the makers",
    660,
    720,
    "Ballroom A",
    "Community",
    "#398c87",
    "The people and stories behind your favorite creations.",
  ),
  p(
    "story",
    "The art of storytelling",
    960,
    1020,
    "Cedar",
    "Writing",
    "#a97491",
    "Build stories with a beginning, a middle, and a little magic.",
  ),
  p(
    "social",
    "Moonlight social",
    1200,
    1290,
    "Ballroom B",
    "Community",
    "#398c87",
    "Wind down, meet new friends, and share your favorite con moments.",
  ),
  {
    ...p(
      "market",
      "Artists' Alley",
      600,
      1080,
      "Exhibit Hall",
      "Art",
      "#8b6fc0",
      "Browse prints, meet artists, and find a little something to take home.",
    ),
    dropIn: true,
  },
  p(
    "welcome",
    "Welcome to the pack",
    840,
    900,
    "Ballroom A",
    "Community",
    "#398c87",
    "Your first stop for a great con weekend.",
    18,
  ),
  p(
    "farewell",
    "Until next time",
    840,
    900,
    "Ballroom A",
    "Community",
    "#398c87",
    "One last gathering before we head home.",
    20,
  ),
];
export const overlapMinutes = (a: Panel, b: Panel): number =>
  a.day !== b.day || a.dropIn || b.dropIn
    ? 0
    : Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
export type Attendance = { join: number; leave: number };
export type AttendanceTimes = Readonly<Record<string, Attendance>>;
export function validateAttendance(
  item: Panel,
  value: Attendance,
): string | null {
  if (!Number.isInteger(value.join) || !Number.isInteger(value.leave))
    return "Choose a valid join and leave time.";
  if (value.join < item.start || value.leave > item.end)
    return "Your times must stay within the event's published times.";
  if (value.join >= value.leave) return "Leave time must be after join time.";
  return null;
}
export function attendancePanel(
  item: Panel,
  times: AttendanceTimes = {},
): Panel {
  const value = times[item.id];
  return value && !validateAttendance(item, value)
    ? { ...item, start: value.join, end: value.leave }
    : item;
}
export const getConflicts = (
  candidate: Panel,
  plan: ReadonlySet<string>,
  times: AttendanceTimes = {},
): Panel[] =>
  panels.filter(
    (item) =>
      item.id !== candidate.id &&
      plan.has(item.id) &&
      overlapMinutes(
        attendancePanel(candidate, times),
        attendancePanel(item, times),
      ) > 0,
  );
export function commitChoice(
  candidate: Panel,
  plan: ReadonlySet<string>,
  keepBoth = false,
  times: AttendanceTimes = {},
): Set<string> {
  const next = new Set(plan);
  if (!keepBoth)
    for (const conflict of getConflicts(candidate, plan, times))
      next.delete(conflict.id);
  next.add(candidate.id);
  return next;
}
const icons: Record<string, string> = {
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  bookmark:
    '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
  plan: '<rect x="5" y="4" width="15" height="18" rx="3"/><path d="M9 2v4M16 2v4m-8 7 2 2 4-5M9 18h6"/>',
  now: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-5 2 2-5Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  filter:
    '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="var(--paper)"/><circle cx="16" cy="12" r="2" fill="var(--paper)"/><circle cx="9" cy="18" r="2" fill="var(--paper)"/>',
  wifi: '<path d="M3 8c5-4 13-4 18 0M6 12c3-3 9-3 12 0M9 16c2-2 4-2 6 0"/><circle cx="12" cy="19" r=".7" fill="currentColor"/>',
  signal: '<path d="M4 18v-3M9 18v-6M14 18V9M19 18V5"/>',
  overlap:
    '<rect x="3" y="4" width="11" height="13" rx="3"/><rect x="10" y="8" width="11" height="13" rx="3"/>',
  alert:
    '<path d="m10 4-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2.3 2.3 0 0 0-4 0Z"/><path d="M12 9v5M12 17v.1"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  store:
    '<path d="M4 10v11h16V10M3 4h18l1 6H2ZM9 21v-7h6v7M2 10c1 4 4 3 5 0 1 3 4 4 5 0 1 4 4 3 5 0 1 3 4 4 5 0"/>',
  heart:
    '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 2 11 8 15 6-4 13-10 8-15Z"/>',
};
const icon = (name: string) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[name] ?? icons.calendar}</svg>`;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const time = (minute: number) =>
  `${Math.floor(minute / 60) % 12 || 12}${minute % 60 ? `:${String(minute % 60).padStart(2, "0")}` : ":00"}`;
export const timeRange = (item: Panel) =>
  `${time(item.start)}${item.start < 720 && item.end >= 720 ? " AM" : ""}–${time(item.end)} ${item.end >= 720 ? "PM" : "AM"}`;
const dayName = (day: number) =>
  ({ 18: "Friday", 19: "Saturday", 20: "Sunday" })[day] ?? "";
const get = (id: string) => panels.find((item) => item.id === id)!;
type View =
  | "schedule"
  | "plan"
  | "now"
  | "compare"
  | "attendance"
  | "detail"
  | "filters"
  | "convention";
type PhoneState = {
  view: View;
  previous: View;
  selected: string;
  candidates: string[];
  day: number;
  slot: number;
  category: string;
  query: string;
  segment: "going" | "interested";
  toast: string;
  draft: Record<string, Attendance>;
  timingError: string;
};
let interested = new Set([
  "photo",
  "draw",
  "first",
  "makers",
  "story",
  "social",
]);
let plan = new Set(["photo", "draw", "makers", "story", "social"]);
const sampleAttendance = (): Record<string, Attendance> => ({
  photo: { join: 840, leave: 865 },
  draw: { join: 875, leave: 920 },
});
let attendance: Record<string, Attendance> = sampleAttendance();
const planned = (item: Panel) => attendancePanel(item, attendance);
const plannedOverlap = (a: Panel, b: Panel) =>
  overlapMinutes(planned(a), planned(b));
const prototypeNow = 858;
let density = 8;
let notice = "";
const initialState = (view: View): PhoneState => ({
  view,
  previous: "plan",
  selected: "draw",
  candidates: ["photo", "draw", "first"],
  day: 19,
  slot: 840,
  category: "All categories",
  query: "",
  segment: "going",
  toast: "",
  draft: sampleAttendance(),
  timingError: "",
});
const states: Record<string, PhoneState> = {
  browse: initialState("schedule"),
  compare: initialState("attendance"),
  plan: initialState("plan"),
};
const demoPanels = () =>
  panels.filter((_, index) => index >= 10 || index < density);
const dayPanels = (state: PhoneState) =>
  demoPanels().filter((item) => item.day === state.day && !item.dropIn);
const slotPanels = (state: PhoneState) =>
  dayPanels(state)
    .filter((item) => item.start < state.slot + 60 && item.end > state.slot)
    .sort((a, b) => a.start - b.start);
const filteredPanels = (state: PhoneState) =>
  slotPanels(state).filter(
    (item) =>
      (state.category === "All categories" ||
        item.category === state.category) &&
      `${item.title} ${item.room} ${item.host} ${item.category}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
const allConflicts = (state: PhoneState) =>
  panels.filter(
    (item) =>
      item.day === state.day &&
      plan.has(item.id) &&
      getConflicts(item, plan, attendance).length > 0,
  );
const currentPanel = (state: PhoneState) =>
  panels
    .filter(
      (item) =>
        item.day === state.day &&
        plan.has(item.id) &&
        !item.dropIn &&
        planned(item).end > prototypeNow,
    )
    .sort((a, b) => planned(a).start - planned(b).start)[0];
const status = () =>
  `<div class="statusbar"><span>2:18</span><div class="island"></div><div class="status-icons">${icon("signal")}${icon("wifi")}<i class="battery"></i></div></div>`;
function tabs(active: View) {
  return `<div class="tabs-wrap"><nav class="native-tabs" aria-label="App navigation">${[
    ["schedule", "calendar", "Schedule"],
    ["plan", "plan", "My Plan"],
    ["now", "now", "Now"],
  ]
    .map(
      ([view, symbol, label]) =>
        `<button data-nav="${view}" class="${active === view ? "active" : ""}" aria-current="${active === view ? "page" : "false"}">${icon(symbol)}<span>${label}</span></button>`,
    )
    .join("")}</nav></div>`;
}
function header(title: string, state: PhoneState, dates = false, extra = "") {
  return `<header class="native-header"><div class="navline"><button class="navback" data-action="convention">${icon("back")}Lakeside Fur Con</button><button class="circle-btn" data-action="filters" aria-label="Filter schedule">${icon("filter")}</button></div><div class="title-line"><h2>${title}</h2>${extra}</div>${
    dates
      ? `<div class="date-strip"><div class="month-label">SEPTEMBER<br>2026</div>${[
          [18, "FRI"],
          [19, "SAT"],
          [20, "SUN"],
        ]
          .map(
            ([day, label]) =>
              `<button class="date ${state.day === day ? "selected" : ""}" data-day="${day}" aria-label="${label} September ${day}" aria-pressed="${state.day === day}"><span>${label}</span><strong>${day}</strong></button>`,
          )
          .join("")}</div>`
      : `<div class="native-subtitle">${dayName(state.day)}, September ${state.day}</div>`
  }</header>`;
}
function eventRow(item: Panel) {
  return `<div class="event-row" style="--event:${item.color}"><div class="category-bar"></div><button class="event-main" data-detail="${item.id}"><strong>${item.title}</strong><span class="event-meta">${item.room} <span aria-hidden="true">·</span> ${item.category}</span><span class="event-time">${timeRange(item)}${plan.has(item.id) ? '<span class="going-label">Going</span>' : ""}</span>${plan.has(item.id) && attendance[item.id] ? `<span class="personal-row-time">Your time · ${timeRange(planned(item))}</span>` : ""}</button><button class="save ${interested.has(item.id) ? "saved" : ""}" data-save="${item.id}" aria-label="${interested.has(item.id) ? "Remove interest in" : "Interested in"} ${item.title}" aria-pressed="${interested.has(item.id)}">${icon("bookmark")}</button></div>`;
}
function schedule(state: PhoneState) {
  const rows = filteredPanels(state);
  return `${header("Schedule", state, true)}<div class="native-header" style="padding-top:0"><label class="searchbox">${icon("search")}<input aria-label="Search panels, people, rooms" placeholder="Search panels, people, rooms" value="${escapeHtml(state.query)}"></label></div><div class="time-strip" aria-label="Time slots">${[660, 840, 960, 1200].map((minute) => `<button data-slot="${minute}" class="time-chip ${state.slot === minute ? "active" : ""}" aria-pressed="${state.slot === minute}">${Math.floor(minute / 60) % 12 || 12} ${minute < 720 ? "AM" : "PM"}</button>`).join("")}</div><div class="scroll" data-scroll><div class="section-heading"><span>${time(state.slot)}–${time(state.slot + 60)} ${state.slot < 720 ? "AM" : "PM"}</span><small>${rows.length}${rows.length !== slotPanels(state).length ? ` of ${slotPanels(state).length}` : ""} ${rows.length === 1 ? "option" : "options"}</small></div>${state.category !== "All categories" ? `<p class="section-hint">${state.category} filter <button data-action="clear-filters" style="color:var(--blue)">Clear</button></p>` : '<p class="section-hint">Pick what catches your eye. Decide later.</p>'}<div class="event-list">${rows.length ? rows.map(eventRow).join("") : '<div class="empty">No panels here yet.<br>Try another time or clear your filters.<br><button class="secondary-button" data-action="clear-filters">Clear filters</button></div>'}</div>${state.day === 19 ? `<div class="section-heading"><span>Drop in anytime</span><small>Not a timed commitment</small></div><button class="dropin" data-detail="market"><span class="icon">${icon("store")}</span><span><strong>Artists' Alley</strong><small>10 AM–6 PM · Exhibit Hall</small></span>${icon("chevron")}</button>` : ""}<div class="inline-note">${icon("bookmark")}Interested is a bookmark, not a reservation.</div></div>${tabs("schedule")}`;
}
function agenda(state: PhoneState) {
  const personal = panels.filter((item) => item.day === state.day);
  const list = personal
    .filter((item) =>
      (state.segment === "going" ? plan : interested).has(item.id),
    )
    .sort((a, b) =>
      state.segment === "going"
        ? planned(a).start - planned(b).start
        : a.start - b.start,
    );
  const conflicts = allConflicts(state);
  const hasPortions = list.some(
    (item) =>
      attendance[item.id] &&
      (planned(item).start !== item.start || planned(item).end !== item.end),
  );
  return `${header("My Plan", state, true)}
    <div class="native-header" style="padding-top:0"><div class="segment" aria-label="Plan view">
      <button data-segment="going" class="${state.segment === "going" ? "active" : ""}" aria-pressed="${state.segment === "going"}">Going · ${personal.filter((p) => plan.has(p.id)).length}</button>
      <button data-segment="interested" class="${state.segment === "interested" ? "active" : ""}" aria-pressed="${state.segment === "interested"}">Interested · ${personal.filter((p) => interested.has(p.id)).length}</button>
    </div></div>
    <div class="scroll" data-scroll>
      ${notice ? `<div class="notice success">${icon("check")}<div class="notice-content"><strong>Plan updated</strong><p>${escapeHtml(notice)}</p></div></div>` : ""}
      ${conflicts.length ? `<div class="notice warn">${icon("alert")}<div class="notice-content"><strong>${conflicts.length} attendance windows overlap</strong><p>Keep both or adjust when you join and leave.</p><button data-attendance="${conflicts[0].id}">Adjust your times →</button></div></div>` : hasPortions && state.segment === "going" ? `<div class="notice">${icon("overlap")}<div class="notice-content"><strong>A little of both</strong><p>Your chosen times make room for more panels.</p><button data-attendance="draw">Edit join & leave times →</button></div></div>` : ""}
      ${
        state.segment === "interested"
          ? `<p class="section-hint">Save as many as you like. Plan the parts you want.</p><div class="event-list">${list.length ? list.map(eventRow).join("") : '<div class="empty">No interests saved for this day.<br>Bookmark a panel in Schedule.</div>'}</div>`
          : `
        <div class="section-heading"><span>Your ${dayName(state.day)}</span><small>${list.length} planned</small></div>
        <div class="agenda">${
          list.length
            ? list
                .map((item, index) => {
                  const visit = planned(item);
                  const partial =
                    visit.start !== item.start || visit.end !== item.end;
                  return `${index ? gap(planned(list[index - 1]), visit) : ""}
            <div class="agenda-row"><div class="agenda-time">${time(visit.start)}<small>${visit.start >= 720 ? "PM" : "AM"}</small></div>
              <button class="agenda-entry ${visit.end <= prototypeNow ? "past" : ""}" data-detail="${item.id}" style="--event:${item.color}">
                <strong>${item.title}</strong><span class="event-meta">${item.room} · ${partial ? "Your time" : "Until"} ${partial ? timeRange(visit) : time(visit.end)}</span>
                ${partial ? `<span class="official-time">Event: ${timeRange(item)}</span>` : ""}
                <span class="going-label">${visit.end <= prototypeNow ? "Earlier today" : getConflicts(item, plan, attendance).length ? "⚠ Attendance overlaps" : partial ? `Leave at ${time(visit.end)} PM` : "✓ Going"}</span>
              </button>
            </div>`;
                })
                .join("")
            : '<div class="empty">Your day is open.<button class="secondary-button" data-nav="schedule">Browse panels</button></div>'
        }</div>`
      }
      <div class="inline-note">${icon("heart")}Your plan changes. Event times stay the same.</div>
    </div>${tabs("plan")}`;
}
export function gap(a: Panel, b: Panel) {
  const minutes = b.start - a.end;
  return `<div class="gap">${minutes > 0 ? `${minutes >= 60 ? `${Math.floor(minutes / 60)} ${minutes < 120 ? "hour" : "hours"}${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`} free · ${minutes >= 60 ? "Take a breather" : "Time to get there"}` : minutes === 0 ? "Back-to-back · Check your next room" : `${overlapMinutes(a, b)} min overlap · Choose what works`}</div>`;
}
function comparison(state: PhoneState) {
  const candidate = get(state.selected);
  const conflicts = getConflicts(candidate, plan, attendance);
  const current = state.candidates.map(get).find((item) => plan.has(item.id));
  const list = state.candidates.map(get).filter(Boolean);
  return `<div class="compare-backdrop"><h2>My Plan</h2><div class="ghost-row">${dayName(candidate.day)}, September ${candidate.day}<br><br>Your afternoon</div></div><section class="sheet" role="dialog" aria-modal="true" aria-label="Compare panels"><div class="grabber"></div><div class="sheet-top"><span>${list.length} ${list.length === 1 ? "possibility" : "possibilities"}</span><button class="circle-btn subtle" data-action="dismiss" aria-label="Close comparison">${icon("close")}</button></div><div class="sheet-title"><h2>Make room for a favorite.</h2><p>These panels share some of the same time.<br>Which one feels most like you?</p></div><div class="scroll" data-scroll role="radiogroup" aria-label="Choose a panel">${list.map((item) => `<button class="compare-card ${state.selected === item.id ? "selected" : ""}" style="--event:${item.color}" data-select="${item.id}" role="radio" aria-checked="${state.selected === item.id}" aria-label="Choose ${item.title}"><div class="card-kicker">${item.category}${plan.has(item.id) ? '<span class="current-pill">In your plan</span>' : ""}<span class="radio">${state.selected === item.id ? icon("check") : ""}</span></div><h3>${item.title}</h3><div class="card-facts"><span>${icon("clock")}${timeRange(item)}</span><span>${icon("pin")}${item.room}</span></div><p>${item.short}</p>${current && current.id !== item.id && plannedOverlap(current, item) ? `<div class="compare-overlap">${icon("overlap")}${plannedOverlap(current, item)} min overlaps your current choice</div>` : ""}</button>`).join("")}</div><div class="sheet-footer"><p class="footer-note">${plan.has(candidate.id) ? "Other possibilities stay in Interested." : conflicts.length ? `Replaces ${conflicts.map((item) => item.title).join(" and ")}.<br>Your previous ${conflicts.length === 1 ? "choice stays" : "choices stay"} in Interested.` : "Your other interests stay saved for later."}</p><button class="primary" data-action="commit">${icon("check")}${plan.has(candidate.id) ? (conflicts.length ? "Keep only this panel" : "Keep this plan") : conflicts.length ? "Switch to this panel" : "Add to my plan"}</button>${conflicts.length ? '<button class="secondary-button" data-action="keep-both">Keep both in my plan</button>' : ""}<button class="secondary-button" data-action="edit-portions">Set join & leave times</button></div></section>`;
}
function now(state: PhoneState) {
  const next = currentPanel(state);
  const visit = next ? planned(next) : null;
  const following = panels
    .filter(
      (item) =>
        item.day === state.day &&
        plan.has(item.id) &&
        item.id !== next?.id &&
        !item.dropIn &&
        planned(item).end > prototypeNow,
    )
    .sort((a, b) => planned(a).start - planned(b).start)[0];
  const options = dayPanels(state).filter(
    (item) =>
      item.start < 900 && item.end > prototypeNow && item.id !== next?.id,
  );
  return `${header("Now & next", state)}
    <div class="scroll" data-scroll><div class="inline-note">${dayName(state.day)} · 2:18 PM · Sample clock</div>
      ${
        next && visit
          ? `<section class="now-hero"><div class="eyebrow">${icon("now")} ${visit.start > prototypeNow ? `Join in ${visit.start - prototypeNow} min` : "Your panel · right now"}</div>
        <h3>${next.title}</h3><div class="now-time">Your time · ${timeRange(visit)}</div>
        <div class="leave-callout"><span>Leave at</span><strong>${time(visit.end)} <small>PM</small></strong><span>${visit.end - prototypeNow} min to go</span></div>
        <div class="location-card">${icon("pin")}<div><strong>${next.room}</strong><small>${next.level} · Lakeside Convention Center</small></div></div>
        ${following ? `<div class="next-hop"><span>${plannedOverlap(next, following) > 0 ? "ALSO PLANNED · FROM" : "NEXT · JOIN"} ${time(planned(following).start)} PM</span><strong>${following.title}</strong><small>${following.room} · ${plannedOverlap(next, following) > 0 ? `${plannedOverlap(next, following)} min overlaps your attendance` : `${planned(following).start - visit.end} min between your choices`}</small></div>` : ""}
        <button class="primary" data-attendance="${next.id}">Adjust my times ${icon("chevron")}</button>
      </section>`
          : '<div class="empty">No next stop picked yet.<button class="secondary-button" data-nav="schedule">Explore the schedule</button></div>'
      }
      <div class="section-heading"><span>Other options this hour</span><small>${options.length} options</small></div><div class="event-list">${options.map(eventRow).join("")}</div>
    </div>${tabs("now")}`;
}
function detail(state: PhoneState) {
  const item = get(state.selected);
  const conflicts = getConflicts(item, plan, attendance);
  return `<section class="sheet" style="top:0;border-radius:0" role="dialog" aria-modal="true" aria-label="${item.title}"><div class="sheet-top"><button class="navback" data-action="dismiss">${icon("back")}Back</button><button class="circle-btn subtle" data-action="dismiss" aria-label="Close panel details">${icon("close")}</button></div><div class="scroll" data-scroll><div class="detail"><div class="card-kicker" style="--event:${item.color}">${item.category}<span class="mini-badge">All ages</span></div><h2>${item.title}</h2><div class="detail-facts"><div class="fact-row">${icon("calendar")}<div>September ${item.day}, 2026<small>${timeRange(item)} · ${item.end - item.start} minutes${item.dropIn ? " · Drop in anytime" : ""}</small></div></div><div class="fact-row">${icon("pin")}<div>${item.room}<small>${item.level} · Convention Center</small></div></div><div class="fact-row">${icon("people")}<div>${item.host}<small>Panel host</small></div></div></div>${attendance[item.id] ? `<div class="detail-attendance"><strong>Your attendance</strong><p>${timeRange(planned(item))} · Leave at ${time(planned(item).end)} PM</p></div>` : ""}<h3>About this panel</h3><p>${item.description}</p><button class="interest-action" data-save="${item.id}" aria-pressed="${interested.has(item.id)}">${icon("bookmark")}${interested.has(item.id) ? "Saved to Interested" : "I'm interested"}</button>${!item.dropIn ? `<button class="secondary-button" data-attendance="${item.id}">Set join & leave times</button>` : ""}<p style="font-size:12px;margin-top:10px;text-align:center">Saving a panel does not reserve a seat.</p></div>${conflicts.length ? `<div class="notice warn">${icon("overlap")}<div class="notice-content"><strong>Overlaps your plan</strong><p>${conflicts.map((other) => `${plannedOverlap(item, other)} min with ${other.title}`).join("; ")}</p></div></div>` : ""}</div><div class="sheet-footer"><button class="primary" data-action="${plan.has(item.id) ? "remove-plan" : item.dropIn ? "save-dropin" : "add-plan"}">${icon(plan.has(item.id) ? "check" : "plus")}${plan.has(item.id) ? "Going · Remove from plan" : item.dropIn ? "Save this drop-in" : conflicts.length ? "Compare before adding" : "Add to my plan"}</button></div></section>`;
}
const inputTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export function parseTimeInput(value: string): number {
  if (value.length !== 5) return NaN;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}
function attendanceEditor(state: PhoneState) {
  const entries = Object.keys(state.draft)
    .map(get)
    .sort((a, b) => state.draft[a.id].join - state.draft[b.id].join);
  const valid = entries.every(
    (item) => !validateAttendance(item, state.draft[item.id]),
  );
  const draftVisits = entries.map((item) => attendancePanel(item, state.draft));
  const times = { ...attendance, ...state.draft };
  const choices = panels.filter(
    (item) => plan.has(item.id) || item.id in state.draft,
  );
  const conflicts = valid
    ? choices.flatMap((item, index) =>
        choices
          .slice(index + 1)
          .filter(
            (other) =>
              (item.id in state.draft || other.id in state.draft) &&
              overlapMinutes(
                attendancePanel(item, times),
                attendancePanel(other, times),
              ) > 0,
          )
          .map((other) =>
            overlapMinutes(
              attendancePanel(item, times),
              attendancePanel(other, times),
            ),
          ),
      )
    : [];
  const minutesBetween =
    valid && draftVisits.length === 2
      ? draftVisits[1].start - draftVisits[0].end
      : null;
  return `<div class="compare-backdrop"><h2>My Plan</h2></div>
    <section class="sheet attendance-sheet" role="dialog" aria-modal="true" aria-label="Edit attendance times">
      <div class="grabber"></div><div class="sheet-top"><span>Your time, your choice</span><button class="circle-btn subtle" data-action="dismiss" aria-label="Close attendance editor">${icon("close")}</button></div>
      <div class="sheet-title"><h2>${entries.length === 2 ? "Make time for both." : entries.length > 2 ? "Make room in your day." : "Make this time yours."}</h2><p>Catch the parts you want.<br>Choose when you'll join and leave.</p></div>
      <div class="scroll" data-scroll>
        ${entries
          .map(
            (
              item,
              index,
            ) => `<section class="attendance-card" style="--event:${item.color}">
          <div class="card-kicker"><span>${String(index + 1).padStart(2, "0")} · ${item.category}</span><span class="current-pill">${plan.has(item.id) ? "In your plan" : "Add to your plan"}</span></div>
          <h3>${item.title}</h3><p>${item.room} · Event ${timeRange(item)}</p>
          <label class="attendance-field"><span>Join at</span><input type="time" aria-label="Join ${item.title} at" data-timing-id="${item.id}" data-timing-field="join" value="${inputTime(state.draft[item.id].join)}" min="${inputTime(item.start)}" max="${inputTime(item.end - 1)}" step="60"></label>
          <label class="attendance-field"><span>Leave at</span><input type="time" aria-label="Leave ${item.title} at" data-timing-id="${item.id}" data-timing-field="leave" value="${inputTime(state.draft[item.id].leave)}" min="${inputTime(item.start + 1)}" max="${inputTime(item.end)}" step="60"></label>
          ${state.draft[item.id].join > item.start ? `<small>Joining ${state.draft[item.id].join - item.start} min after the event starts.</small>` : ""}
        </section>`,
          )
          .join("")}
        ${valid && (conflicts.length || draftVisits.length > 1) ? `<div class="timing-summary ${conflicts.length ? "warning" : ""}">${icon(conflicts.length ? "alert" : "clock")}<div><strong>${conflicts.length > 1 ? `${conflicts.length} overlaps in your plan` : conflicts.length ? `${conflicts[0]} min still overlaps` : minutesBetween === 0 ? "Back-to-back" : minutesBetween !== null ? `${minutesBetween} min between panels` : "Your times fit together"}</strong><span>${conflicts.length ? "You can keep these choices and adjust later." : "Any gap is your buffer, not a walking-time estimate."}</span></div></div>` : ""}
        <p class="section-hint">Joining late depends on the panel's entry rules. Your choices don't change the published schedule.</p>
        ${state.timingError ? `<div class="timing-error" role="alert">${escapeHtml(state.timingError)}</div>` : ""}
      </div>
      <div class="sheet-footer"><button class="primary" data-action="save-attendance">${icon("check")}${conflicts.length ? "Save with overlap" : "Save my times"}</button><button class="secondary-button" data-action="full-events">Use full event times</button></div>
    </section>`;
}
function openAttendance(key: string, id: string) {
  const state = states[key];
  const item = get(id);
  const partners = panels.filter(
    (other) =>
      other.id !== id && plan.has(other.id) && overlapMinutes(item, other) > 0,
  );
  state.selected = id;
  state.draft = Object.fromEntries(
    [item, ...partners].map((panel) => [
      panel.id,
      { join: planned(panel).start, leave: planned(panel).end },
    ]),
  );
  state.timingError = "";
  navigate(key, "attendance");
}
function saveAttendance(key: string) {
  const state = states[key];
  for (const [id, value] of Object.entries(state.draft)) {
    const error = validateAttendance(get(id), value);
    if (error) {
      state.timingError = `${get(id).title}: ${error}`;
      renderPhone(key);
      return;
    }
  }
  for (const [id, value] of Object.entries(state.draft)) {
    attendance[id] = { ...value };
    plan.add(id);
    interested.add(id);
  }
  notice = "Your join and leave times are saved. Event times are unchanged.";
  state.segment = "going";
  navigate(key, "plan");
  renderAll();
}
function filters(state: PhoneState) {
  return `<section class="sheet" role="dialog" aria-modal="true" aria-label="Filter panels"><div class="grabber"></div><div class="sheet-top"><span>Schedule filters</span><button class="circle-btn subtle" data-action="dismiss" aria-label="Close filters">${icon("close")}</button></div><div class="sheet-title"><h2>A little more you.</h2><p>Filter the selected day and time.<br>Every panel still has a place in All categories.</p></div><div class="scroll" data-scroll><div class="filter-options"><h3>Category</h3>${["All categories", "Fursuiting", "Art", "Community", "Games", "Writing", "Performance"].map((category) => `<button class="filter-option ${state.category === category ? "selected" : ""}" data-category="${category}" aria-pressed="${state.category === category}">${category}${state.category === category ? icon("check") : ""}</button>`).join("")}</div></div><div class="sheet-footer"><button class="primary" data-action="apply-filters">Show ${filteredPanels(state).length} panels</button><button class="secondary-button" data-action="clear-filters">Reset filters</button></div></section>`;
}
function convention() {
  return `<section class="sheet" role="dialog" aria-modal="true" aria-label="Convention information"><div class="grabber"></div><div class="sheet-top"><span>Your convention</span><button class="circle-btn subtle" data-action="dismiss" aria-label="Close convention information">${icon("close")}</button></div><div class="detail"><img src="/app-icon.png" alt="" width="64" height="64" style="border-radius:18px;margin-bottom:22px"><h2>Lakeside Fur Con</h2><p>September 18–20, 2026<br>Lakeside Convention Center</p><h3>Your weekend, together.</h3><p>Explore panels, save your possibilities, and leave room for the people you meet along the way.</p><div class="notice" style="margin:24px 0"><div class="notice-content"><strong>Fictional demo convention</strong><p>All events, hosts, rooms, and times are sample content for this design exploration.</p></div></div></div><div class="sheet-footer" style="margin-top:auto"><button class="primary" data-nav="schedule">Explore the schedule</button></div></section>`;
}
function renderPhone(key: string) {
  const element = document.getElementById(`phone-${key}`)!;
  const state = states[key];
  const scrollTop = element.querySelector("[data-scroll]")?.scrollTop ?? 0;
  element.innerHTML = `${status()}<div class="app-body">${{ schedule, plan: agenda, now, compare: comparison, attendance: attendanceEditor, detail, filters, convention }[state.view](state)}</div><div class="home-indicator"></div>${state.toast ? `<div class="toast" role="status">${icon("check")}${escapeHtml(state.toast)}</div>` : ""}`;
  const scroll = element.querySelector("[data-scroll]");
  if (scroll) scroll.scrollTop = scrollTop;
}
function renderAll() {
  for (const key of Object.keys(states)) renderPhone(key);
}
function navigate(key: string, view: View) {
  const state = states[key];
  state.previous =
    state.view === "compare" ||
    state.view === "detail" ||
    state.view === "filters" ||
    state.view === "attendance"
      ? "plan"
      : state.view;
  state.view = view;
  state.toast = "";
  const scroll = document
    .getElementById(`phone-${key}`)
    ?.querySelector("[data-scroll]");
  if (scroll) scroll.scrollTop = 0;
  renderPhone(key);
  if (
    ["compare", "attendance", "detail", "filters", "convention"].includes(view)
  )
    document
      .querySelector<HTMLElement>(`#phone-${key} .sheet button`)
      ?.focus({ preventScroll: true });
}
function notify(key: string, text: string) {
  states[key].toast = text;
  renderPhone(key);
  setTimeout(() => {
    if (states[key].toast === text) {
      states[key].toast = "";
      renderPhone(key);
    }
  }, 2600);
}
function compareFrom(key: string, id: string) {
  const candidate = get(id);
  const candidates = panels.filter(
    (item) =>
      item.day === states[key].day &&
      (interested.has(item.id) || plan.has(item.id) || item.id === id) &&
      (item.id === id || overlapMinutes(item, candidate) > 0),
  );
  states[key].candidates = candidates
    .sort(
      (a, b) =>
        Number(plan.has(b.id)) - Number(plan.has(a.id)) || a.start - b.start,
    )
    .map((item) => item.id);
  states[key].selected = id;
  navigate(key, "compare");
}
function save(key: string, id: string) {
  if (interested.has(id)) interested.delete(id);
  else interested.add(id);
  renderAll();
  notify(
    key,
    interested.has(id)
      ? "Saved to Interested"
      : plan.has(id)
        ? "Interest removed. Still in your plan."
        : "Removed from Interested",
  );
}
function commit(key: string, keepBoth = false) {
  const candidate = get(states[key].selected);
  const conflicts = getConflicts(candidate, plan, attendance);
  for (const previous of conflicts) interested.add(previous.id);
  interested.add(candidate.id);
  plan = commitChoice(candidate, plan, keepBoth, attendance);
  notice =
    keepBoth && conflicts.length
      ? "Both panels kept. Overlap marked below."
      : conflicts.length
        ? `${candidate.title} is your pick. Your other interests stay saved.`
        : `${candidate.title} is in your plan.`;
  states[key].segment = "going";
  states[key].day = candidate.day;
  navigate(key, "plan");
  renderAll();
}
function reset() {
  interested = new Set(["photo", "draw", "first", "makers", "story", "social"]);
  plan = new Set(["photo", "draw", "makers", "story", "social"]);
  attendance = sampleAttendance();
  states.browse = initialState("schedule");
  states.compare = initialState("attendance");
  states.plan = initialState("plan");
  notice = "";
  renderAll();
}
function showPage(page: string) {
  const pages = ["prototype", "widgets", "watch", "live", "states", "notes"];
  if (!pages.includes(page)) page = "prototype";
  for (const id of pages)
    document.getElementById(id)!.classList.toggle("hidden", id !== page);
  document.getElementById("notes")!.classList.toggle("open", page === "notes");
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
    button.setAttribute(
      "aria-current",
      button.dataset.page === page ? "page" : "false",
    );
  });
  history.replaceState(null, "", `#${page}`);
}
function init() {
  mountWidgets(document.getElementById("widgets")!);
  mountWatch(document.getElementById("watch")!);
  mountEmptyStates(document.getElementById("states")!);
  mountLiveAlerts(document.getElementById("live")!);
  renderAll();
  showPage(location.hash.slice(1));
  document.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLElement>("button");
    if (!target) return;
    const data = target.dataset;
    if (data.page) {
      showPage(data.page);
      return;
    }
    if (data.mode) {
      document.body.classList.toggle("focus", data.mode === "focus");
      document
        .querySelectorAll<HTMLElement>("[data-mode]")
        .forEach((button) => {
          button.classList.toggle("active", button.dataset.mode === data.mode);
          button.setAttribute(
            "aria-pressed",
            String(button.dataset.mode === data.mode),
          );
        });
      return;
    }
    if (data.action === "theme" || data.action === "text-size") {
      const active = document.body.classList.toggle(
        data.action === "theme" ? "dark" : "large-text",
      );
      target.setAttribute("aria-pressed", String(active));
      return;
    }
    if (data.action === "reset") {
      reset();
      return;
    }
    const key = target.closest<HTMLElement>("[data-phone]")?.dataset.phone;
    if (!key) return;
    const state = states[key];
    if (data.nav) {
      navigate(key, data.nav as View);
      return;
    }
    if (data.day) {
      state.day = Number(data.day);
      notice = "";
      navigate(key, state.view);
      return;
    }
    if (data.slot) {
      state.slot = Number(data.slot);
      navigate(key, "schedule");
      return;
    }
    if (data.segment) {
      state.segment = data.segment as PhoneState["segment"];
      navigate(key, "plan");
      return;
    }
    if (data.save) {
      save(key, data.save);
      return;
    }
    if (data.attendance) {
      openAttendance(key, data.attendance);
      return;
    }
    if (data.detail) {
      state.selected = data.detail;
      navigate(key, "detail");
      return;
    }
    if (data.select) {
      state.selected = data.select;
      renderPhone(key);
      document
        .querySelector<HTMLElement>(
          `#phone-${key} [data-select="${data.select}"]`,
        )
        ?.focus({ preventScroll: true });
      return;
    }
    if (data.compare) {
      compareFrom(key, data.compare);
      return;
    }
    if (data.category) {
      state.category = data.category;
      renderPhone(key);
      return;
    }
    switch (data.action) {
      case "edit-portions":
        openAttendance(key, state.selected);
        break;
      case "save-attendance":
        saveAttendance(key);
        break;
      case "full-events":
        state.draft = Object.fromEntries(
          Object.keys(state.draft).map((id) => [
            id,
            { join: get(id).start, leave: get(id).end },
          ]),
        );
        state.timingError = "";
        renderPhone(key);
        break;
      case "commit":
        commit(key);
        break;
      case "keep-both":
        commit(key, true);
        break;
      case "add-plan":
        getConflicts(get(state.selected), plan, attendance).length
          ? compareFrom(key, state.selected)
          : commit(key);
        break;
      case "remove-plan":
        plan.delete(state.selected);
        notice = `${get(state.selected).title} removed from your plan.`;
        navigate(key, "plan");
        renderAll();
        break;
      case "save-dropin":
        interested.add(state.selected);
        renderAll();
        notify(key, "Drop-in saved. No time blocked.");
        break;
      case "filters":
        navigate(key, "filters");
        break;
      case "convention":
        navigate(key, "convention");
        break;
      case "dismiss":
        navigate(
          key,
          state.previous === "detail" ||
            state.previous === "compare" ||
            state.previous === "attendance"
            ? "plan"
            : state.previous,
        );
        break;
      case "apply-filters":
        navigate(key, "schedule");
        break;
      case "clear-filters":
        state.category = "All categories";
        state.query = "";
        renderPhone(key);
        break;
    }
  });
  document.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.tagName !== "INPUT") return;
    const key = input.closest<HTMLElement>("[data-phone]")?.dataset.phone;
    if (!key) return;
    if (input.dataset.timingId) return;
    const cursor = input.selectionStart;
    states[key].query = input.value;
    renderPhone(key);
    const replacement = document.querySelector<HTMLInputElement>(
      `#phone-${key} input`,
    )!;
    replacement.focus();
    replacement.setSelectionRange(cursor, cursor);
  });
  document.getElementById("density")!.addEventListener("change", (event) => {
    density = Number((event.target as HTMLSelectElement).value);
    renderAll();
  });
  document.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const id = input.dataset.timingId;
    const field = input.dataset.timingField as keyof Attendance | undefined;
    const key = input.closest<HTMLElement>("[data-phone]")?.dataset.phone;
    if (!id || !field || !key) return;
    states[key].draft[id][field] = parseTimeInput(input.value);
    states[key].timingError =
      validateAttendance(get(id), states[key].draft[id]) ?? "";
    renderPhone(key);
  });
  document.addEventListener("keydown", (event) => {
    const element = event.target as HTMLElement;
    const key = element.closest<HTMLElement>("[data-phone]")?.dataset.phone;
    if (!key) return;
    const state = states[key];
    const sheet = element.closest<HTMLElement>(".sheet");
    if (event.key === "Escape" && sheet) {
      event.preventDefault();
      navigate(
        key,
        state.previous === "detail" ||
          state.previous === "compare" ||
          state.previous === "attendance"
          ? "plan"
          : state.previous,
      );
      return;
    }
    if (event.key === "Tab" && sheet) {
      const buttons = [
        ...sheet.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,a[href],[tabindex="0"]',
        ),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && element === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && element === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (
      ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key) &&
      element.dataset.select
    ) {
      event.preventDefault();
      const index = state.candidates.indexOf(state.selected);
      const step =
        event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      state.selected =
        state.candidates[
          (index + step + state.candidates.length) % state.candidates.length
        ];
      renderPhone(key);
      document
        .querySelector<HTMLElement>(
          `#phone-${key} [data-select="${state.selected}"]`,
        )
        ?.focus();
    }
  });
}
if (typeof document !== "undefined") init();
