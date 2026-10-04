// Copy review only. Native screens keep their existing state and navigation logic.
const statusScenarios = [
  [
    "loading",
    "Quick load · schedule skeleton",
    "Loading your schedule",
    "Reading the schedule saved on this phone. Your picks will appear when loading finishes.",
    "View Conventions",
    "A local query is pending. Keep the screen shell and show matching skeleton rows only if loading lasts long enough to be visible. Cached rows stay visible during refresh.",
  ],
  [
    "downloading",
    "First schedule download",
    "Downloading the schedule",
    "Keep ConPaws open while this sample download finishes. The schedule is not ready offline yet.",
    "Cancel Download",
    "First download is incomplete. Only confirm offline readiness after the complete schedule is committed locally.",
  ],
  [
    "offline-ready",
    "Offline · saved schedule available",
    "Your saved schedule is available",
    "You’re offline. Browse your downloaded schedule and saved picks. New organizer changes need a connection.",
    "Browse Saved Schedule",
    "Connectivity is known to be offline and a complete local copy exists. Do not hide readable events behind this message.",
  ],
  [
    "offline-no-copy",
    "Offline · no downloaded schedule",
    "Connect to download this con",
    "There is no downloaded schedule on this phone yet. Connect to the internet, then try again.",
    "Try Again",
    "Connectivity is known to be offline and this edition has no local copy. Other downloaded conventions remain available.",
  ],
  [
    "refreshing",
    "Checking for schedule changes",
    "Checking for updates",
    "Your saved schedule stays available while we check for room, time, and cancellation changes.",
    "Browse Saved Schedule",
    "Refresh is pending with a last good local copy. This is a nonblocking status, not a replacement for the event list.",
  ],
  [
    "refresh-failed",
    "Update failed · saved copy retained",
    "Couldn’t update the schedule",
    "Your previous download is still available. Last downloaded today at 10:15 AM. Try again when you have a connection.",
    "Retry Update",
    "An update failed and the previous complete copy was retained. Show the failure separately from the last successful download.",
  ],
  [
    "unavailable",
    "Catalog · schedule unavailable",
    "Schedule unavailable in ConPaws",
    "This convention is listed, but its schedule is not available in ConPaws yet. You can check the organizer’s website or import a verified feed.",
    "View Organizer Website",
    "Catalog availability is explicit. This does not prove that the organizer has not published a schedule elsewhere.",
  ],
  [
    "cancelled",
    "Saved panel cancelled",
    "This panel was cancelled",
    "Evening sketch jam is cancelled in the latest schedule. It remains in your plan with this notice so you can choose another panel.",
    "Browse Alternatives",
    "A published revision explicitly marks a saved event cancelled. Retain its stable ID and saved choice; suppress its obsolete reminder.",
  ],
  [
    "changed",
    "Saved panel room or time changed",
    "Your panel has changed",
    "Character design now starts at 2:45 PM in Oak. Previously: 2:35 PM in Cedar. Review your plan and reminder.",
    "Review Changed Panel",
    "A new revision changed a saved event. Show old and new values; preserve personal choices and recompute affected reminders.",
  ],
  [
    "alerts-denied",
    "Reminders · permission denied",
    "Reminders are turned off",
    "Your plan is saved, but ConPaws cannot send notifications. Allow notifications in Settings if you want reminders.",
    "Open Notification Settings",
    "Notification permission is denied. Saving a panel still works; do not claim a reminder has been scheduled.",
  ],
  [
    "conflict",
    "Saved panels overlap",
    "Two picks overlap",
    "Fursuit photography and Character design overlap for 25 minutes. Keep both or review which parts you want to attend.",
    "Review Overlap",
    "A strict interval overlap exists, including across midnight. This is a warning, not a forced removal or reservation rule.",
  ],
  [
    "current-only",
    "Final picked panel still running",
    "You’re at your last pick",
    "Closing circle is running until 4:00 PM in Ballroom A. No later panels are saved today.",
    "View Current Panel",
    "A saved panel is still active with no later pick. Keep the current panel visible until its actual end.",
  ],
] as const;

export const emptyStateScenarios = [
  ...statusScenarios.map(([id, label, title, body, action, condition]) => ({
    id,
    label,
    title,
    body,
    action,
    condition,
    screen: "Schedule",
    symbol:
      id === "current-only" || id === "refreshing" || id === "loading"
        ? "clock"
        : "warning",
    secondary: "",
    destination: action,
    date: "Fictional status scenario · September 19",
    current:
      "Proposed status presentation; native delivery is not verified by this preview.",
    boundary:
      "This selector illustrates known state. It does not perform downloads, detect connectivity, publish changes, or schedule notifications.",
  })),
  {
    id: "upcoming-empty",
    label: "Con coming up · no picks",
    screen: "My Plan",
    symbol: "calendar",
    title: "15 days to go",
    body: "Lakeside Fur Con starts September 18. Browse the schedule and pick what you want to catch.",
    action: "Browse Schedule",
    secondary: "",
    destination: "The convention schedule",
    date: "September 3 · 15 days before the con",
    current: "In 15 days" + " · My Schedule is empty",
    condition:
      "The convention starts in the future, its schedule has events, and you have not picked any. Keep the countdown and the next step together.",
    boundary:
      "The date is the first convention day. It is not a doors-open time. Picking a panel does not reserve a seat.",
  },
  {
    id: "upcoming-ready",
    label: "Con coming up · picks ready",
    screen: "My Plan",
    symbol: "calendar",
    title: "Your con is getting closer",
    body: "15 days until Lakeside Fur Con. Your picks are ready to review, and you can change them anytime.",
    action: "Review My Plan",
    secondary: "Browse Schedule",
    destination: "Your picked panels",
    date: "September 3 · 15 days before the con",
    current: "In 15 days" + " · saved events already appear in My Schedule",
    condition:
      "The same upcoming convention, with picked panels. Show the dates and the next saved stop; do not ask the person to start over.",
    boundary:
      "The native app already computes the countdown in the convention’s time zone. Keep Today / Tomorrow / In N days as the date changes.",
  },
  {
    id: "no-convention",
    label: "No conventions added",
    screen: "Conventions",
    symbol: "calendar",
    title: "No conventions yet",
    body: "Import a schedule to start planning your con. You can also create a convention and add events yourself.",
    action: "Import Schedule",
    secondary: "Create Convention",
    destination: "The existing schedule importer",
    date: "First use · no convention on this device",
    current: "No conventions yet · Create one or import an existing schedule.",
    condition:
      "The local convention list is empty. The current app already makes Import Schedule the primary action and Create Convention the secondary action.",
    boundary:
      "An empty widget snapshot can also mean unavailable data. A widget should say Open ConPaws, not assume the person has never added a convention.",
  },
  {
    id: "no-events",
    label: "Con added · no events",
    screen: "Schedule",
    symbol: "calendar",
    title: "No events added yet",
    body: "Import a schedule or add events yourself. They’ll appear here when you add them.",
    action: "Import Schedule",
    secondary: "Add Event",
    destination: "The existing schedule importer",
    date: "September 3 · convention saved, event list empty",
    current: "No events yet · Import a schedule or add events manually.",
    condition:
      "A convention exists, but its local event list is empty. Show the convention dates so this screen still feels connected to the upcoming con.",
    boundary:
      "There is no schedule-publication field. Do not claim the organizer has not published it, or promise an alert when it arrives.",
  },
  {
    id: "no-picks",
    label: "Con underway · no picks",
    screen: "My Plan",
    symbol: "bookmark",
    title: "Your plan starts with a panel",
    body: "Browse the schedule and add the panels you want to catch. You can make time for more than one.",
    action: "Browse Schedule",
    secondary: "",
    destination: "The convention schedule",
    date: "September 19 · schedule available, no picked panels",
    current:
      "Nothing starred yet · Tap an event inside a convention to add it to My Schedule — it lands here.",
    condition:
      "The schedule has events, but your personal list is empty. The native app currently has one saved state; My Plan / Interested are proposed terms in this exploration.",
    boundary:
      "No picks is different from no events. Do not send the person back through Import when the schedule is already available.",
  },
  {
    id: "no-matches",
    label: "Search or filters match nothing",
    screen: "Schedule",
    symbol: "search",
    title: "No panels match",
    body: "Try another search or clear your filters to see more of the schedule.",
    action: "Clear Filters",
    secondary: "",
    destination: "The schedule with search and filters cleared",
    date: "September 19 · active search or category filter",
    current: "No matching events · Try another search or filter.",
    condition:
      "The current view has an active search or filter, and no matching rows. Clearing it should preserve the selected convention.",
    boundary:
      "Do not say No events yet here. The filter result does not describe the whole convention schedule.",
  },
  {
    id: "between-panels",
    label: "A break between picked panels",
    screen: "Now & next",
    symbol: "clock",
    title: "Nothing planned right now",
    body: "Your next stop is Character design at 2:35 PM in Cedar. You have a little time before you join.",
    action: "View Next Panel",
    secondary: "Browse Schedule",
    destination: "Character design panel details",
    date: "September 19 · 2:30 PM · next join at 2:35 PM",
    current: "Nothing from My Schedule is happening right now.",
    condition:
      "No picked panel is active, but a future one exists. Use that real next stop to make the quiet moment useful.",
    boundary:
      "The native app uses published event times today. The partial-attendance proposal uses your join time. Neither gap is a measured walking time.",
  },
  {
    id: "plan-finished",
    label: "Today’s picked panels finished",
    screen: "Now & next",
    symbol: "check",
    title: "That’s your plan for today",
    body: "You’ve reached the end of today’s picks. There may still be other panels to catch.",
    action: "Browse Schedule",
    secondary: "Review My Plan",
    destination: "The convention schedule",
    date: "September 19 · 9:35 PM · final pick has ended",
    current: "No more upcoming events in My Schedule.",
    condition:
      "There were picked panels today, none is still running, and none remains today. If another pick exists tomorrow, show it instead of implying the whole plan is finished.",
    boundary:
      "The convention may still be running. Some existing widget branches lose the final active panel; fix that selection before using finished copy there.",
  },
  {
    id: "no-upcoming",
    label: "Past cons only",
    screen: "Conventions",
    symbol: "archive",
    title: "Ready for your next con?",
    body: "Your past conventions are in Archive. Import a schedule when you’re ready to plan another.",
    action: "Import Schedule",
    secondary: "View Archive",
    destination: "The existing schedule importer",
    date: "September 21 · past convention retained in Archive",
    current: "No upcoming conventions.",
    condition:
      "The local list contains past or archived conventions, with no current convention. The native app already keeps this separate from first use.",
    boundary:
      "Do not erase the person’s history or present them as a new user. Explicitly archived future conventions can also appear in Archive.",
  },
  {
    id: "load-error",
    label: "Schedule could not load",
    screen: "My Plan",
    symbol: "warning",
    title: "Couldn’t load your schedule",
    body: "Try again to load your picked panels.",
    action: "Try Again",
    secondary: "",
    destination: "Retry loading the local schedule",
    date: "Loading failed · data state is unknown",
    current: "Your schedule could not be loaded.",
    condition:
      "A data query failed. This must win over empty-state messaging; the app has not established that the list is empty.",
    boundary:
      "A widget or Watch has different snapshot information. Do not label a stale snapshot Offline unless connectivity is actually known.",
  },
] as const;

type StateId = (typeof emptyStateScenarios)[number]["id"];
export const phoneFlowSteps: StateId[] = [
  "no-convention",
  "downloading",
  "loading",
  "upcoming-empty",
  "upcoming-ready",
  "offline-ready",
  "changed",
  "current-only",
  "plan-finished",
];

const symbolPaths: Record<string, string> = {
  calendar:
    '<rect x="4" y="6" width="24" height="23" rx="4"/><path d="M4 13h24M10 3v7M22 3v7M11 20h10M16 15v10"/>',
  bookmark: '<path d="M8 5h16v24l-8-5-8 5z"/>',
  search: '<circle cx="14" cy="14" r="9"/><path d="m21 21 8 8"/>',
  clock: '<circle cx="16" cy="16" r="12"/><path d="M16 9v8l5 3"/>',
  check: '<circle cx="16" cy="16" r="12"/><path d="m10 16 4 4 8-9"/>',
  archive:
    '<rect x="4" y="5" width="24" height="6" rx="2"/><path d="M6 11v16h20V11M12 16h8"/>',
  warning: '<path d="m16 4 13 23H3zM16 12v7M16 23h.01"/>',
};
const symbol = (name: string) =>
  `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${symbolPaths[name]}</svg>`;

export function mountEmptyStates(root: HTMLElement) {
  let selected: StateId = "upcoming-empty";
  const flow = phoneFlowSteps;
  let flowStep = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const edits = new Map<StateId, { title: string; body: string }>();
  let returnFocus: HTMLElement | null = null;
  root.innerHTML = `<style>
    .es-flow-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:18px 0 24px}.es-flow-controls button,.es-flow-controls a{min-height:44px;padding:10px 16px;border:1px solid #ccd7e1;border-radius:12px;background:white;color:#005575;font-size:14px;font-weight:600}.es-flow-controls span{font-size:13px;color:#536277}.es-overview{margin:40px 0}.es-overview h3{font-size:26px;margin:0 0 8px}.es-overview>p{font-size:14px;color:#536277;line-height:1.6}.es-state-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin-top:20px}.es-state-tile{display:flex;flex-direction:column;align-items:stretch;text-align:left;border:1px solid #d4dee7;border-radius:22px;padding:16px;background:white;color:#091533;min-height:350px;gap:14px}.es-state-tile:focus-visible{outline:3px solid #007ba8;outline-offset:3px}.es-state-tile[aria-pressed=true]{border-color:#007ba8;box-shadow:0 0 0 2px #007ba8}.es-state-tile>small{font-size:12px;color:#536277;line-height:1.5}.es-mini-phone{border:1px solid #d9e1e9;border-radius:18px;padding:18px;background:#f2f2f7;flex:1}.es-mini-phone>span{display:block;font-size:12px;color:#536277;margin-bottom:20px}.es-mini-phone svg{width:30px;height:30px;color:#007ba8;margin:4px 0 15px}.es-mini-phone strong{display:block;font-size:20px;line-height:1.2;margin-bottom:12px}.es-mini-phone p{font-size:14px;line-height:1.55;color:#536277;margin:0 0 20px}.es-mini-phone em{display:block;font-size:13px;font-style:normal;font-weight:600;color:#005575}.es-mini-phone .es-skeleton{padding:0}.es-flow-active .es-message,.es-flow-active .es-skeleton{animation:es-flow-in .25s ease-out}.dark .es-state-tile{background:#172134;color:#eef3f8;border-color:#34445b}.dark .es-mini-phone{background:#1e2e42;border-color:#34445b}.dark .es-mini-phone p,.dark .es-mini-phone>span,.dark .es-state-tile>small{color:#bbc8d7}.dark .es-mini-phone em{color:#77d7f9}@keyframes es-flow-in{from{opacity:.3;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.es-flow-active .es-message,.es-flow-active .es-skeleton{animation:none}}@media(max-width:480px){.es-state-grid{grid-template-columns:1fr}}
    .es-skeleton{padding:18px 20px}.es-skeleton-group{width:42%;height:12px;background:var(--line);border-radius:6px;margin-bottom:18px}.es-skeleton-row{display:flex;gap:15px;padding:22px 0;border-bottom:1px solid var(--line)}.es-skeleton-time{width:42px;height:16px;background:var(--line);border-radius:6px;flex-shrink:0}.es-skeleton-lines{flex:1}.es-skeleton-lines i{display:block;height:16px;background:var(--line);border-radius:6px;margin-bottom:10px}.es-skeleton-lines i:last-child{width:60%;height:12px;margin:0}.es-loading-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.es-message[hidden]{display:none}
    .es-page{color:#17243a}.es-head{display:flex;align-items:end;justify-content:space-between;gap:30px;margin:34px 0 25px}.es-head h2{font-size:36px;letter-spacing:-1.2px;line-height:1.08;margin:0 0 12px}.es-head h2 span{color:#005575}.es-head p{color:#68758a;line-height:1.6;max-width:450px;margin:0;font-size:14px}.es-kicker{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#537588;margin-bottom:13px}.es-controls{border-block:1px solid #dbe2e9;padding:15px 0;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:28px}.es-controls label{display:flex;align-items:center;gap:14px;font-size:13px}.es-controls select{font:inherit;background:white;border:1px solid #d5dce6;border-radius:10px;min-height:44px;padding:8px 12px;max-width:100%}.es-controls>span{font-size:12px;color:#69778a}.es-layout{display:grid;grid-template-columns:354px minmax(0,1fr);align-items:start;gap:50px;max-width:1000px;margin:auto}.es-phone-label{font-size:12px;color:#5c6e84;margin:0 0 13px}.es-device .native-header{padding-top:12px;padding-bottom:20px}.es-con-name{font-size:14px;color:var(--blue);padding-bottom:14px}.es-device .native-subtitle{font-size:13px}.es-message{padding:28px 27px 34px;display:flex;flex-direction:column;justify-content:center;flex:1;text-align:center;min-height:min-content}.es-symbol{color:var(--blue);width:58px;height:58px;margin:0 auto 22px}.es-symbol svg{width:100%;height:100%}.es-message h3{font-size:26px;line-height:1.18;letter-spacing:-.7px;margin:0 0 13px}.es-message p{font-size:16px;line-height:1.5;color:var(--secondary);margin:0 0 27px}.es-message .primary{font-size:16px}.es-card{padding:16px;background:var(--paper);border:1px solid var(--line);border-radius:17px;text-align:left;margin:0 0 26px}.es-card span{font-size:11px;color:var(--secondary);display:block;margin-bottom:6px}.es-card strong{font-size:16px;display:block;line-height:1.4}.es-card small{font-size:13px;color:var(--secondary);display:block;margin-top:4px}.es-bottom{border-top:1px solid var(--line);background:var(--paper);display:flex;gap:5px;padding:15px 15px 33px;margin-top:auto;color:var(--secondary);font-size:11px;flex-shrink:0}.es-bottom button{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-height:44px}.es-bottom svg{height:22px;width:22px}.es-bottom button.active{color:var(--blue)}.es-device .scroll{display:flex;flex-direction:column;padding-bottom:0}.es-device .app-body{height:790px}.es-copy{background:#fff;border:1px solid #dce3e9;border-radius:23px;padding:27px}.es-copy h3{font-size:22px;letter-spacing:-.5px;margin:0 0 9px}.es-copy>p,.es-context p{font-size:14px;line-height:1.6;color:#65758a}.es-copy label{display:block;font-size:13px;font-weight:600;margin-top:23px}.es-copy input,.es-copy textarea{display:block;width:100%;font:inherit;font-weight:400;font-size:15px;line-height:1.5;border:1px solid #d4dce6;border-radius:12px;padding:12px;margin-top:8px;background:#fff;color:#15243b}.es-copy textarea{resize:vertical;min-height:132px}.es-copy input:focus-visible,.es-copy textarea:focus-visible,.es-controls select:focus-visible{outline:3px solid #0faced;outline-offset:2px}.es-reset{margin-top:15px;border:1px solid #d7dfe7;border-radius:11px;padding:10px 15px;min-height:44px;color:#005575;font-size:13px}.es-context{padding:22px 1px 0}.es-context h4{font-size:13px;margin:0 0 8px}.es-context p{margin:0 0 20px}.es-current{padding:14px 17px;background:#e9edf2;border-radius:12px}.es-current span{display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:7px;color:#6a7689}.es-links{display:flex;gap:6px;flex-wrap:wrap;margin-top:20px}.es-links button{min-height:44px;padding:10px 15px;border:1px solid #cfdbe5;border-radius:12px;color:#005575;font-size:13px}.es-dialog{width:min(430px,calc(100% - 40px));border:1px solid #dae2e9;border-radius:24px;padding:27px;color:#17243a;background:#f8f9fc}.es-dialog::backdrop{background:#09153366;backdrop-filter:blur(4px)}.es-dialog h3{font-size:23px;margin:0 0 12px}.es-dialog p{font-size:15px;line-height:1.6;color:#64748a}.es-dialog button{display:block;width:100%;min-height:44px;border-radius:12px;margin-top:10px;background:#005575;color:white;padding:10px}.es-dialog button:last-child{color:#005575;background:#e8eef3}.large-text .es-message h3{font-size:31px}.large-text .es-message p{font-size:21px}.large-text .es-card strong{font-size:20px}.large-text .es-card small{font-size:17px}.large-text .es-message{padding-block:24px}.es-footnote{font-size:12px;line-height:1.6;color:#6a798b;margin:20px 0 0}
    @media(max-width:1050px){.es-layout{gap:25px}.es-head{align-items:start}.es-head h2{font-size:31px}.es-copy{padding:21px}.es-controls>span{display:none}}
    @media(max-width:740px){.es-head{display:block}.es-head p{margin-top:17px}.es-layout{grid-template-columns:1fr;justify-items:center;gap:25px}.es-copy-column{width:100%;max-width:520px}.es-controls label{display:block;width:100%}.es-controls select{display:block;margin-top:8px;width:100%}.es-head h2{font-size:32px}}
    @media(max-width:390px){.es-layout{justify-items:start}.es-phone-wrap{width:318px}.es-device{transform:scale(.9);transform-origin:top left;margin-bottom:-75px}.es-phone-label{font-size:11px}}
  </style><div class="es-page">
    <div class="es-head"><div><div class="es-kicker">Phone flow · Empty & status states</div><h2>Every state.<br><span>A clear next step.</span></h2></div><p>Compare empty, upcoming, loading, download, offline, update, reminder, and event-change states. These are fictional previews; a status must not hide a usable saved schedule.</p></div>
    <div class="es-controls"><label>Situation<select aria-label="Empty or upcoming situation">${emptyStateScenarios.map((s) => `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${s.label}</option>`).join("")}</select></label><span>Fictional sample data · Edit copy to compare</span></div>
    <div class="es-layout"><div class="es-phone-wrap"><p class="es-phone-label" data-es-date></p><div class="device es-device"><div class="screen"><div class="statusbar"><span>9:41</span><div class="island"></div><div class="status-icons"><span aria-hidden="true">▮▮▮</span><i class="battery"></i></div></div><div class="app-body" data-es-phone></div><div class="home-indicator"></div></div></div><p class="es-footnote">iOS layout illustration · Use the top controls to compare larger text and dark appearance.</p></div>
    <div class="es-copy-column"><section class="es-copy" aria-label="Empty state copy editor"><div class="es-kicker">Copy playground</div><h3>Say what happened.<br>Show what to do next.</h3><p>Try the wording on the phone. Edits stay in this tab until you reload.</p><label>Title<input data-es-title aria-label="Empty state title" maxlength="100"></label><label>Message<textarea data-es-body aria-label="Empty state message" maxlength="400"></textarea></label><button class="es-reset" data-es-reset>Reset this wording</button></section><section class="es-context" aria-label="Codebase findings"><h4>When this message fits</h4><p data-es-condition></p><div class="es-current"><span>Current app wording</span><p data-es-current></p></div><h4 style="margin-top:22px">What the app can tell us</h4><p data-es-boundary></p><div class="es-links"><button data-page="widgets">See widget states</button><button data-page="watch">See Watch states</button></div><p class="es-footnote">Mockup copy only. Existing app translations, imports, and saved schedules are unchanged.</p></section></div></div>
    <dialog class="es-dialog" aria-label="Mockup action destination"><div class="es-kicker">Action preview</div><h3 data-es-action-title></h3><p data-es-action-body></p><button data-es-populated>Explore the sample schedule</button><button data-es-close>Back to wording</button></dialog>
  </div>`;

  const get = () => emptyStateScenarios.find((s) => s.id === selected)!;
  const query = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const dialog = query<HTMLDialogElement>("dialog");
  const skeletonRows = () =>
    `<div class="es-skeleton-group"></div>${Array.from({ length: 4 }, () => '<div class="es-skeleton-row"><span class="es-skeleton-time"></span><span class="es-skeleton-lines"><i></i><i></i></span></div>').join("")}`;
  query(".es-controls").insertAdjacentHTML(
    "afterend",
    `<nav class="es-flow-controls" aria-label="Phone flow playback"><button type="button" data-es-play>Play flow</button><button type="button" data-es-back>Previous</button><button type="button" data-es-next>Next</button><span data-es-flow-label aria-live="polite">Nine moments from setup to the end of your day · 3 seconds each</span><a href="#${root.id}-overview">Review all 22 states ↓</a></nav>`,
  );
  query(".es-page").insertAdjacentHTML(
    "beforeend",
    `<section id="${root.id}-overview" class="es-overview" aria-label="All phone states"><h3>All 22 states, together.</h3><p>Baseline copy and compact screen previews. Choose any card to inspect it on the full phone above. Playback shows proposed moments across different days; it does not perform a download or sync.</p><div class="es-state-grid">${emptyStateScenarios.map((s) => `<button type="button" class="es-state-tile" data-es-select="${s.id}" aria-label="Review ${s.label}" aria-pressed="false"><small>${s.label}</small><div class="es-mini-phone"><span>ConPaws · ${s.screen}</span>${s.id === "loading" ? `<div class="es-skeleton" aria-hidden="true">${skeletonRows()}</div><span>Schedule placeholders</span>` : `${symbol(s.symbol)}<strong>${s.title}</strong><p>${s.body}</p><em>${s.action} ›</em>`}</div><small>Open full preview ↑</small></button>`).join("")}</div></section>`,
  );

  function pause() {
    clearInterval(timer);
    timer = undefined;
    root.classList.remove("es-flow-active");
    query("[data-es-play]").textContent = "Play flow";
  }
  function showFlowStep() {
    selected = flow[flowStep];
    query<HTMLSelectElement>("select").value = selected;
    render();
    query("[data-es-flow-label]").textContent =
      `Step ${flowStep + 1} of ${flow.length} · ${get().label}`;
  }

  function render() {
    const state = get();
    root.querySelectorAll<HTMLElement>("[data-es-select]").forEach((tile) => {
      tile.setAttribute(
        "aria-pressed",
        String(tile.dataset.esSelect === selected),
      );
    });
    const copy = edits.get(selected) ?? {
      title: state.title,
      body: state.body,
    };
    query("[data-es-date]").textContent = state.date;
    query("[data-es-condition]").textContent = state.condition;
    query("[data-es-current]").textContent = state.current;
    query("[data-es-boundary]").textContent = state.boundary;
    query<HTMLInputElement>("[data-es-title]").value = copy.title;
    query<HTMLTextAreaElement>("[data-es-body]").value = copy.body;
    const hasConvention = ![
      "no-convention",
      "no-upcoming",
      "load-error",
    ].includes(selected);
    query("[data-es-phone]").innerHTML =
      `<header class="native-header"><div class="es-con-name">${hasConvention ? "‹ Lakeside Fur Con" : "ConPaws"}</div><h2>${state.screen}</h2>${hasConvention ? '<div class="native-subtitle">September 18–20, 2026</div>' : ""}</header><div class="scroll"><section class="es-message"><div class="es-symbol">${symbol(state.symbol)}</div><h3 data-es-preview-title></h3><p data-es-preview-body></p>${selected === "upcoming-ready" ? '<div class="es-card"><span>YOUR FIRST PICK · SAT, SEP 19</span><strong>Fursuit photography</strong><small>2:00–2:25 PM · Ballroom A</small><small>Join Character design at 2:35 PM</small></div>' : ""}<button class="primary" data-es-action="primary">${state.action}</button>${state.secondary ? `<button class="secondary-button" data-es-action="secondary">${state.secondary}</button>` : ""}</section></div><nav class="es-bottom" aria-label="Sample app navigation"><button data-es-action="conventions" class="${state.screen === "Conventions" || state.screen === "Schedule" ? "active" : ""}" aria-current="${state.screen === "Conventions" || state.screen === "Schedule" ? "page" : "false"}">${symbol("calendar")}Conventions</button><button data-es-action="plan" class="${state.screen === "My Plan" ? "active" : ""}" aria-current="${state.screen === "My Plan" ? "page" : "false"}">${symbol("bookmark")}My Plan</button><button data-es-action="now" class="${state.screen === "Now & next" ? "active" : ""}" aria-current="${state.screen === "Now & next" ? "page" : "false"}">${symbol("clock")}Now</button></nav>`;
    query("[data-es-preview-title]").textContent = copy.title;
    query("[data-es-preview-body]").textContent = copy.body;
    if (selected === "loading") {
      query<HTMLElement>(".es-message").hidden = true;
      query("[data-es-phone] .scroll").insertAdjacentHTML(
        "beforeend",
        `<section class="es-skeleton" role="status" aria-busy="true" aria-label="Loading saved schedule"><span class="es-loading-label">Loading saved schedule</span><div aria-hidden="true"><div class="es-skeleton-group"></div>${Array.from({ length: 4 }, () => '<div class="es-skeleton-row"><span class="es-skeleton-time"></span><span class="es-skeleton-lines"><i></i><i></i></span></div>').join("")}</div></section>`,
      );
    }
  }

  root.addEventListener("change", (event) => {
    if (event.target !== query("select")) return;
    const id = query<HTMLSelectElement>("select").value;
    if (!emptyStateScenarios.some((s) => s.id === id)) return;
    selected = id as StateId;
    pause();
    query("[data-es-flow-label]").textContent =
      "Paused · reviewing a selected state";
    render();
  });
  root.addEventListener("input", (event) => {
    if (
      event.target !== query("[data-es-title]") &&
      event.target !== query("[data-es-body]")
    )
      return;
    const title = query<HTMLInputElement>("[data-es-title]").value;
    const body = query<HTMLTextAreaElement>("[data-es-body]").value;
    edits.set(selected, { title, body });
    query("[data-es-preview-title]").textContent = title;
    query("[data-es-preview-body]").textContent = body;
  });
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button) return;
    if (button.hasAttribute("data-es-play")) {
      if (timer) {
        pause();
        return;
      }
      if (flowStep === flow.length - 1) flowStep = 0;
      root.classList.add("es-flow-active");
      query("[data-es-play]").textContent = "Pause flow";
      showFlowStep();
      timer = setInterval(() => {
        if (
          document.hidden ||
          root.closest(".hidden") ||
          flowStep === flow.length - 1
        ) {
          pause();
          return;
        }
        flowStep++;
        showFlowStep();
        if (flowStep === flow.length - 1) pause();
      }, 3000);
      return;
    }
    if (
      button.hasAttribute("data-es-next") ||
      button.hasAttribute("data-es-back")
    ) {
      pause();
      flowStep = Math.max(
        0,
        Math.min(
          flow.length - 1,
          flowStep + (button.hasAttribute("data-es-next") ? 1 : -1),
        ),
      );
      showFlowStep();
      return;
    }
    if (button.dataset.esSelect) {
      pause();
      selected = button.dataset.esSelect as StateId;
      query<HTMLSelectElement>("select").value = selected;
      render();
      query("[data-es-flow-label]").textContent =
        "Paused · reviewing a selected state";
      query(".es-flow-controls").scrollIntoView({
        block: "start",
        behavior: "auto",
      });
      return;
    }
    if (button.hasAttribute("data-es-reset")) {
      edits.delete(selected);
      render();
    }
    if (button.dataset.esAction) {
      pause();
      returnFocus = button;
      const state = get();
      const action =
        button.dataset.esAction === "primary"
          ? state.action
          : button.dataset.esAction === "secondary"
            ? state.secondary
            : button.textContent!.trim();
      query("[data-es-action-title]").textContent = action;
      query("[data-es-action-body]").textContent =
        button.dataset.esAction === "primary"
          ? `${state.destination}. This is a preview of the action; no data is imported or changed.`
          : `This action would open ${action.toLowerCase()}. This preview keeps your data unchanged.`;
      dialog.showModal();
    }
    if (button.hasAttribute("data-es-close")) dialog.close();
    if (button.hasAttribute("data-es-populated")) {
      dialog.close();
      document
        .querySelector<HTMLButtonElement>(
          '.workbench-nav [data-page="prototype"]',
        )
        ?.click();
    }
  });
  dialog.addEventListener("close", () =>
    returnFocus?.focus({ preventScroll: true }),
  );
  render();
}
