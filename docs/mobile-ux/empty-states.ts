// Copy review only. Native screens keep their existing state and navigation logic.
const statusScenarios = [
  [
    "loading",
    "Loading your schedule",
    "Loading your schedule",
    "Getting your saved schedule ready. Your panels will appear here in a moment.",
    "View Conventions",
    "The app is getting your saved schedule ready. Keep any panels already on screen visible while it checks for changes.",
  ],
  [
    "downloading",
    "Downloading the first schedule",
    "Downloading the schedule",
    "Keep ConPaws open until the download finishes. You can use this schedule without an internet connection once it’s saved.",
    "Cancel Download",
    "The download is not finished yet. Say the schedule is ready only after the full schedule has been saved on this phone.",
  ],
  [
    "offline-ready",
    "No internet · saved schedule",
    "Your saved schedule is ready",
    "You don’t have an internet connection, but your saved schedule and panels are still here. A connection is needed to check for changes.",
    "View Saved Schedule",
    "There is no internet connection, but a full saved schedule is available. Keep it easy to open.",
  ],
  [
    "offline-no-copy",
    "No internet · schedule not saved",
    "Connect to download this con",
    "This schedule isn’t saved on your phone yet. Connect to the internet, then try again.",
    "Try Again",
    "There is no internet connection, and this convention hasn’t been saved on this phone yet. Other saved conventions are still available.",
  ],
  [
    "refreshing",
    "Checking for schedule changes",
    "Checking for updates",
    "Your saved schedule stays here while we check for room, time, or cancellation changes.",
    "Browse Saved Schedule",
    "Keep the saved schedule on screen while ConPaws checks for changes.",
  ],
  [
    "refresh-failed",
    "Couldn’t check for changes",
    "Couldn’t check for changes",
    "Your saved schedule is still here. It was last downloaded today at 10:15 AM. Try again when you’re back online.",
    "Try Again",
    "The latest check did not finish, but the saved schedule is still available. Keep the last download time clear.",
  ],
  [
    "unavailable",
    "Schedule not in ConPaws yet",
    "This schedule isn’t in ConPaws yet",
    "This convention is listed, but its schedule isn’t available here yet. Check the convention’s website, or add a schedule from a link or file.",
    "Visit Convention Website",
    "The convention is listed here, but we don’t know whether its schedule is available somewhere else. Don’t say the organizer hasn’t posted it.",
  ],
  [
    "cancelled",
    "A saved panel was cancelled",
    "This panel was cancelled",
    "Evening sketch jam was cancelled. It’s still in your plan so you can choose another panel.",
    "Find Another Panel",
    "The schedule says this panel was cancelled. Keep it in the plan until the person reviews it, and stop its reminder.",
  ],
  [
    "changed",
    "A panel’s time or room changed",
    "A panel has changed",
    "Character design now starts at 2:45 PM in Oak. It used to start at 2:35 PM in Cedar. Review your plan and reminder.",
    "Review Panel",
    "The schedule changed this panel’s time or room. Show the old and new details, and keep the person’s saved choice.",
  ],
  [
    "alerts-denied",
    "Reminders are off",
    "Reminders are turned off",
    "Your plan is saved, but reminders are off. Turn on notifications in Settings if you’d like a reminder.",
    "Open Settings",
    "Notifications are turned off for ConPaws. Saving panels still works, but reminders won’t appear until they’re turned on.",
  ],
  [
    "conflict",
    "Two panels overlap",
    "Two picks overlap",
    "Fursuit photography and Character design overlap for 25 minutes. Keep both, or choose how long you want to attend each.",
    "Review Times",
    "The times you chose overlap. Show how long they overlap, but let the person keep both panels if they want.",
  ],
  [
    "current-only",
    "Your last panel is still happening",
    "You’re at your last planned panel",
    "Closing circle runs until 4:00 PM in Ballroom A. You don’t have another panel picked after it today.",
    "View Current Panel",
    "A panel you picked is still happening, and nothing else is planned for later today. Keep showing it until it ends.",
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
    date: "Example status · September 19",
    current: "Example wording only. The current ConPaws app has not changed.",
    boundary:
      "These examples don’t download schedules, check your internet, publish changes, or send reminders.",
  })),
  {
    id: "upcoming-empty",
    label: "Con in 15 days · no panels picked",
    screen: "My Plan",
    symbol: "calendar",
    title: "15 days until Lakeside Fur Con",
    body: "Lakeside Fur Con starts September 18. Browse the schedule and choose the panels you want to catch.",
    action: "Browse Schedule",
    secondary: "",
    destination: "the convention schedule",
    date: "September 3 · 15 days before the con",
    current: "In 15 days" + " · My Schedule is empty",
    condition:
      "The convention is coming up, its schedule is available, and no panels have been picked. Show the date and an easy first step.",
    boundary:
      "The countdown uses the first day of the convention, not the time doors open. Picking a panel doesn’t save you a seat.",
  },
  {
    id: "upcoming-ready",
    label: "Con in 15 days · plan ready",
    screen: "My Plan",
    symbol: "calendar",
    title: "Your plan is ready",
    body: "Lakeside Fur Con starts in 15 days. Review your picks anytime, or browse the schedule to add more.",
    action: "Review My Plan",
    secondary: "Browse Schedule",
    destination: "your picked panels",
    date: "September 3 · 15 days before the con",
    current: "In 15 days" + " · saved events already appear in My Schedule",
    condition:
      "The convention is coming up and panels are already picked. Show the dates and the next panel; don’t ask the person to start over.",
    boundary:
      "The countdown uses the convention’s local time. Change the wording as the date gets closer: Today, Tomorrow, then In N days.",
  },
  {
    id: "no-convention",
    label: "No conventions added",
    screen: "Conventions",
    symbol: "calendar",
    title: "No conventions yet",
    body: "Add a convention to start planning. Use a schedule link or file, or create one and add panels yourself.",
    action: "Add a Schedule",
    secondary: "Create Convention",
    destination: "a screen to add a convention",
    date: "First use · no convention added yet",
    current: "No conventions yet · Create one or import an existing schedule.",
    condition:
      "There’s no convention in ConPaws yet. Make it easy to add one from a schedule or create one from scratch.",
    boundary:
      "Don’t tell someone to start over just because a widget is blank; it may not have updated yet.",
  },
  {
    id: "no-events",
    label: "Convention saved · no panels yet",
    screen: "Schedule",
    symbol: "calendar",
    title: "No panels added yet",
    body: "No panels have been added to this convention yet. Add a schedule from a link or file, or add panels yourself.",
    action: "Add a Schedule",
    secondary: "Add Event",
    destination: "a screen to add panels",
    date: "September 3 · convention saved, no panels added",
    current: "No events yet · Import a schedule or add events manually.",
    condition:
      "A convention is saved, but it has no panels listed in ConPaws yet. Show the dates so it still feels connected to the upcoming event.",
    boundary:
      "We don’t know whether the organizer has posted a schedule. Don’t say it hasn’t been posted or promise an alert when it is.",
  },
  {
    id: "no-picks",
    label: "Con underway · no panels picked",
    screen: "My Plan",
    symbol: "bookmark",
    title: "No panels picked yet",
    body: "Browse the schedule and choose the panels you want to catch. You can add more than one.",
    action: "Browse Schedule",
    secondary: "",
    destination: "the convention schedule",
    date: "September 19 · schedule available, no panels picked",
    current:
      "Nothing starred yet · Tap an event inside a convention to add it to My Schedule — it lands here.",
    condition:
      "Panels are listed, but none are in your plan yet. Point to the schedule so you can start choosing.",
    boundary:
      "No panels picked is different from no panels available. Don’t ask someone to import again when the schedule is already there.",
  },
  {
    id: "no-matches",
    label: "Search or filters match nothing",
    screen: "Schedule",
    symbol: "search",
    title: "No panels match these choices",
    body: "Try another time or clear your filters to see more of the schedule.",
    action: "Clear Filters",
    secondary: "",
    destination: "the schedule with your search and filters cleared",
    date: "September 19 · search or filter hides all panels",
    current: "No matching events · Try another search or filter.",
    condition:
      "The current search or filter hides every panel. Clearing it should keep the selected convention.",
    boundary:
      "These results don’t mean the full schedule is empty. Make it easy to change the search or filters.",
  },
  {
    id: "between-panels",
    label: "A break between picked panels",
    screen: "Now & next",
    symbol: "clock",
    title: "Nothing planned right now",
    body: "Character design starts at 2:35 PM in Cedar. You have a little time before it starts.",
    action: "View Next Panel",
    secondary: "Browse Schedule",
    destination: "Character design panel details",
    date: "September 19 · 2:30 PM · next panel starts at 2:35 PM",
    current: "Nothing from My Schedule is happening right now.",
    condition:
      "Nothing you picked is happening now, but another panel starts later. Show that next panel and its start time.",
    boundary:
      "The schedule shows when the panel starts. Your chosen arrival time may be different. Time between panels is not a travel-time estimate.",
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
    destination: "the convention schedule",
    date: "September 19 · 9:35 PM · last picked panel has ended",
    current: "No more upcoming events in My Schedule.",
    condition:
      "Today’s picked panels have ended, and nothing else is planned for today. If another panel is picked for tomorrow, show it instead of saying the whole plan is done.",
    boundary:
      "The convention may still be running. Keep a panel on screen while it’s happening, even if nothing else is planned after it.",
  },
  {
    id: "no-upcoming",
    label: "Past conventions only",
    screen: "Conventions",
    symbol: "archive",
    title: "Ready for your next con?",
    body: "Your past conventions are in Archive. Add a schedule when you’re ready to plan another.",
    action: "Add a Schedule",
    secondary: "View Archive",
    destination: "a screen to add a schedule",
    date: "September 21 · past convention is in Archive",
    current: "No upcoming conventions.",
    condition:
      "Your saved conventions have all ended or are in Archive. Keep them available; don’t show this as a first-use screen.",
    boundary:
      "Keep past conventions in Archive. A future convention can be there too if the person moved it.",
  },
  {
    id: "load-error",
    label: "Couldn’t show the schedule",
    screen: "My Plan",
    symbol: "warning",
    title: "We couldn’t show your schedule",
    body: "Please try again in a moment.",
    action: "Try Again",
    secondary: "",
    destination: "your saved schedule",
    date: "The schedule could not be shown",
    current: "Your schedule could not be loaded.",
    condition:
      "The app couldn’t show the saved schedule. We don’t know whether it’s empty, so show an error instead of an empty message.",
    boundary:
      "Only say there’s no internet when ConPaws knows that. Otherwise, simply say it couldn’t show the schedule.",
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
    <div class="es-head"><div><div class="es-kicker">Phone flow · Empty screens and updates</div><h2>Every situation.<br><span>A clear next step.</span></h2></div><p>See what someone reads when they’re getting started, have nothing planned, or need help. These examples use made-up details and won’t change your saved schedule.</p></div>
    <div class="es-controls"><label>Situation<select aria-label="Empty or upcoming situation">${emptyStateScenarios.map((s) => `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${s.label}</option>`).join("")}</select></label><span>Sample details · Edit the wording to compare</span></div>
    <div class="es-layout"><div class="es-phone-wrap"><p class="es-phone-label" data-es-date></p><div class="device es-device"><div class="screen"><div class="statusbar"><span>9:41</span><div class="island"></div><div class="status-icons"><span aria-hidden="true">▮▮▮</span><i class="battery"></i></div></div><div class="app-body" data-es-phone></div><div class="home-indicator"></div></div></div><p class="es-footnote">iPhone screen example · Use the controls above to try larger text and dark appearance.</p></div>
    <div class="es-copy-column"><section class="es-copy" aria-label="Empty state copy editor"><div class="es-kicker">Edit this message</div><h3>Say what happened.<br>Show what to do next.</h3><p>Try the wording on the phone. Changes stay here until you reload this page.</p><label>Title<input data-es-title aria-label="Empty state title" maxlength="100"></label><label>Message<textarea data-es-body aria-label="Empty state message" maxlength="400"></textarea></label><button class="es-reset" data-es-reset>Restore original wording</button></section><section class="es-context" aria-label="Why this message fits"><h4>Why this message fits</h4><p data-es-condition></p><div class="es-current"><span>Wording in the app today</span><p data-es-current></p></div><h4 style="margin-top:22px">What ConPaws can tell</h4><p data-es-boundary></p><div class="es-links"><button data-page="widgets">See widget examples</button><button data-page="watch">See Watch examples</button></div><p class="es-footnote">These are mockups. The app’s current wording, imports, and saved schedules have not changed.</p></section></div></div>
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
    `<nav class="es-flow-controls" aria-label="Phone flow playback"><button type="button" data-es-play>Play flow</button><button type="button" data-es-back>Previous</button><button type="button" data-es-next>Next</button><span data-es-flow-label aria-live="polite">Nine moments from setup to the end of your day · 3 seconds each</span><a href="#${root.id}-overview">See all 22 examples ↓</a></nav>`,
  );
  query(".es-page").insertAdjacentHTML(
    "beforeend",
    `<section id="${root.id}-overview" class="es-overview" aria-label="All phone examples"><h3>All 22 examples, together.</h3><p>Choose any card to see it on the phone above. The walkthrough shows examples from different days; it won’t download or update anything.</p><div class="es-state-grid">${emptyStateScenarios.map((s) => `<button type="button" class="es-state-tile" data-es-select="${s.id}" aria-label="Review ${s.label}" aria-pressed="false"><small>${s.label}</small><div class="es-mini-phone"><span>ConPaws · ${s.screen}</span>${s.id === "loading" ? `<div class="es-skeleton" aria-hidden="true">${skeletonRows()}</div><span>Loading your schedule</span>` : `${symbol(s.symbol)}<strong>${s.title}</strong><p>${s.body}</p><em>${s.action} ›</em>`}</div><small>View this on the phone ↑</small></button>`).join("")}</div></section>`,
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
    query("[data-es-flow-label]").textContent = "Paused · viewing this example";
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
        "Paused · viewing this example";
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
          ? state.action === "Try Again"
            ? "In the finished app, this would try again to show your schedule. This is only a preview; nothing will change."
            : `In the finished app, this would open ${state.destination}. This is only a preview; nothing will change.`
          : `This would open ${action.toLowerCase()}. This is only a preview; nothing will change.`;
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
