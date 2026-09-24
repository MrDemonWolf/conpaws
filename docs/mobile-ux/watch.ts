type WatchView = "face" | "glance" | "leave" | "change" | "today" | "detail";
type WatchEvent = "photo" | "draw" | "story";
type WatchScenario = "active" | "upcoming" | "empty" | "no-picks" | "done";

const watchScenarios: Record<WatchScenario, string> = {
  active: "Active plan · now & next",
  upcoming: "Upcoming con · 15 days away",
  empty: "No convention on this watch",
  "no-picks": "No panels picked",
  done: "No more picks · all have ended",
};
const watchScenarioCopy = {
  upcoming: { title: "Your next con", message: "Lakeside Fur Con", condition: "A convention is saved and its first date is still ahead. This takes priority even when no panels are picked.", current: "Coming Up · In 15 days · Until the convention", idea: "Use one countdown phrase and the date range. The saved start date is not a doors-open time.", compact: "In 15 days", secondary: "Sep 18–20" },
  empty: { title: "No plan yet", message: "Open ConPaws on your iPhone. Add a convention to get started.", condition: "This watch has no convention in its saved snapshot. It cannot tell whether the phone is also empty or the first snapshot has not arrived.", current: "No schedule yet · Open ConPaws on your iPhone to sync a convention.", idea: "Give a concrete action on the phone. Do not invent a Sync button or imply a transfer is in progress.", compact: "No plan yet", secondary: "Open ConPaws on iPhone" },
  "no-picks": { title: "Your plan is empty", message: "Add panels to your schedule in ConPaws on your iPhone.", condition: "The convention is running, but its saved snapshot contains no planned panels. This says nothing about whether the full program has been published.", current: "No more events today · Today 0", idea: "An empty plan is a starting point. It does not mean the day is finished or the program is unavailable.", compact: "No planned panels", secondary: "Add panels on iPhone" },
  done: { title: "All done for today", message: "All your planned panels have ended.", condition: "In this sample, all three chosen panels have ended and none is still running. The convention itself continues tomorrow.", current: "No more events today", idea: "Only show a done message when the saved plan has earlier events and no current or later event today.", compact: "No more picks today", secondary: "Your last panel ended at 5:00" },
} satisfies Record<Exclude<WatchScenario, "active">, { title: string; message: string; condition: string; current: string; idea: string; compact: string; secondary: string }>;

const watchTiming = (stayFive: boolean) => ({ leave: 865 + (stayFive ? 5 : 0), join: 875, gap: stayFive ? 5 : 10 });
const watchTime = (minutes: number) => `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, "0")}`;
const watchEvents: Record<WatchEvent, { title: string; room: string; official: string; from: number; until: number }> = {
  photo: { title: "Fursuit photography", room: "Ballroom A", official: "2:00–3:00 PM", from: 840, until: 865 },
  draw: { title: "Character design lab", room: "Cedar", official: "2:00–3:30 PM", from: 875, until: 920 },
  story: { title: "The art of storytelling", room: "Cedar", official: "4:00–5:00 PM", from: 960, until: 1020 },
};

const watchCSS = `
.cp-watch{--cpw-cyan:#0faced;--cpw-ink:var(--ink,#091533);--cpw-paper:var(--paper,#fff);--cpw-secondary:var(--secondary,#647080);max-width:1168px;margin:0 auto;padding:18px 0 36px;color:var(--cpw-ink);font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.cp-watch *{box-sizing:border-box}.cp-watch button{font:inherit;cursor:pointer}.cp-watch button:disabled{cursor:default;opacity:.5}.cp-watch button:focus-visible,.cp-watch a:focus-visible,.cp-watch input:focus-visible{outline:3px solid var(--cpw-cyan);outline-offset:4px}
.cpw-intro{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:26px}.cpw-kicker{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--cpw-secondary);margin:0 0 8px}.cpw-intro h2{font-size:32px;line-height:1.12;letter-spacing:-1px;margin:0 0 10px}.cpw-intro p{font-size:14px;line-height:1.55;margin:0;max-width:620px;color:var(--cpw-secondary)}.cpw-demo-state{background:var(--cpw-paper);padding:12px 15px;border:1px solid var(--line,#e2e4e9);border-radius:14px;flex-shrink:0;min-width:224px}.cpw-demo-state label{display:flex;align-items:center;gap:9px;font-size:13px;min-height:28px}.cpw-demo-state input{accent-color:#007ba8;inline-size:17px;block-size:17px}.cpw-demo-state small{display:block;color:var(--cpw-secondary);font-size:11px;margin-top:4px}
.cpw-flow-layout{display:grid;grid-template-columns:minmax(300px,420px) minmax(300px,1fr);gap:42px;align-items:center;background:var(--cpw-paper);border:1px solid var(--line,#e2e4e9);border-radius:28px;padding:26px 38px}
.cpw-device-space{position:relative;height:424px;display:grid;place-items:center}.cpw-device-space:before{content:"";position:absolute;width:162px;height:414px;background:linear-gradient(90deg,#13171c,#303740 40%,#282d34 65%,#14181d);border-radius:35px;box-shadow:inset 0 0 0 3px #10141a,inset 10px 0 10px #0004}.cpw-hardware{position:relative;width:236px;height:276px;padding:12px;background:linear-gradient(125deg,#737b82,#171b20 17%,#454b51 43%,#11151a 70%,#575f66);border-radius:56px;box-shadow:inset 0 0 0 2px #333a40,0 18px 28px #09153330;transform:scale(1.25)}.cpw-hardware:before{content:"";position:absolute;width:10px;height:30px;border-radius:3px;right:-9px;top:66px;background:repeating-linear-gradient(0deg,#4a5057,#4a5057 2px,#20252a 2px,#20252a 3px);box-shadow:2px 0 1px #111}.cpw-hardware:after{content:"";position:absolute;width:5px;height:39px;border-radius:3px;right:-4px;top:124px;background:#3a4148}
.cpw-screen{width:208px;height:248px;border-radius:43px;background:#000;color:#f5f5f7;overflow:hidden;position:relative;letter-spacing:-.15px;box-shadow:0 0 0 3px #030406;font-size:15px;line-height:1.2}.cpw-screen h3,.cpw-screen p{margin:0}.cpw-watch-bar{display:flex;justify-content:space-between;align-items:center;height:35px;padding:6px 15px 0 12px;font-size:12px;font-weight:650}.cpw-watch-bar button{display:inline-flex;align-items:center;gap:4px;padding:0;color:#f5f5f7;min-width:38px;min-height:32px;font-size:12px;background:none;border:none;text-align:left}.cpw-watch-bar .cpw-back{font-size:29px;line-height:20px;font-weight:400}.cpw-watch-bar time{font-size:14px;font-variant-numeric:tabular-nums}.cpw-scroll{height:213px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#61646a transparent;padding:3px 9px 30px}.cpw-screen button{border:0}.cpw-screen .cpw-muted{color:#a9adb6}.cpw-screen .cpw-tiny{font-size:11px;line-height:1.35}.cpw-screen .cpw-label{font-size:11px;font-weight:700;letter-spacing:.7px;color:#a9adb6;margin-bottom:3px}.cpw-screen .cpw-label.cyan{color:#56cbfa}.cpw-screen .cpw-label.amber{color:#ffc36e}.cpw-leave-hero{padding:0 4px 7px}.cpw-leave-value{display:block;font-size:36px;line-height:1.04;font-weight:700;letter-spacing:-1px;color:#56cbfa;font-variant-numeric:tabular-nums}.cpw-leave-value span{font-size:19px;font-weight:600;letter-spacing:-.4px}.cpw-watch-current{padding:0 4px 10px}.cpw-watch-current strong{font-size:15px;font-weight:650;display:block;line-height:1.12}.cpw-watch-current p{font-size:11px;color:#a9adb6;margin-top:4px}.cpw-watch-row{display:block;width:100%;padding:10px 10px 11px;background:#1c1d21;border-radius:15px;color:#f5f5f7;text-align:left;margin:0 0 7px;font-size:15px;line-height:1.15}.cpw-watch-row strong{font-weight:650;display:block;margin:3px 0}.cpw-watch-row .cpw-muted{display:block;font-size:12px}.cpw-watch-row.current{background:#092f3e;border:1px solid #12526b}.cpw-watch-row .cpw-label{margin:0}.cpw-watch-button{width:100%;display:block;min-height:38px;border-radius:22px;padding:10px 8px;background:#25262b;color:#f5f5f7;font-size:14px;font-weight:600;text-align:center;margin-top:7px;line-height:1.2}.cpw-watch-button.primary{background:#0faced;color:#001722}.cpw-watch-button.secondary{background:#143847;color:#83dafd}.cpw-watch-footnote{font-size:11px;line-height:1.4;color:#a9adb6;padding:8px 4px 0}.cpw-saved{font-size:11px;background:#322817;color:#ffcf83;border-radius:9px;padding:7px 8px;margin-bottom:8px;line-height:1.35}.cpw-confirmation{font-size:11px;color:#99e5ba;background:#14291d;padding:7px 8px;border-radius:9px;margin-bottom:8px;line-height:1.35}.cpw-room-hero{font-size:32px;font-weight:700;line-height:1.05;letter-spacing:-.9px;margin:4px 0 6px!important}.cpw-room-hero.small{font-size:22px;line-height:1.15;margin:5px 0 9px!important}.cpw-watch-block{padding:3px 4px 7px}.cpw-watch-detail{font-size:13px;line-height:1.35;padding:8px 3px;border-bottom:1px solid #292a2e}.cpw-watch-detail .cpw-label{display:block}.cpw-watch-gap{padding:0 10px 9px;color:#a9adb6;font-size:11px}.cpw-mini-map{display:flex;align-items:center;gap:7px;font-size:12px;color:#c8ccd5;margin:9px 0}.cpw-mini-map span{height:1px;background:#484d55;flex:1}.cpw-compare{background:#1c1d21;border-radius:14px;padding:10px;margin:9px 0}.cpw-compare p{display:flex;justify-content:space-between;font-size:13px;margin:4px 0}.cpw-compare strong{font-variant-numeric:tabular-nums}.cpw-warning{color:#ffca80;font-size:12px;line-height:1.4;margin:9px 3px!important}.cpw-face .cpw-watch-bar{justify-content:center;color:#56cbfa;height:30px;padding:9px 10px 0;font-size:11px}.cpw-face-time{font-size:54px;font-weight:650;line-height:1;letter-spacing:-3px;text-align:center;font-variant-numeric:tabular-nums;margin:1px 0 9px}.cpw-face-comp{display:block;width:calc(100% - 26px);margin:auto;padding:9px 10px;background:#102934;border-radius:14px;text-align:left;color:#fff;font-size:13px;line-height:1.25}.cpw-face-comp strong{display:block;color:#6cd1f9;font-size:19px;margin:2px 0 4px}.cpw-face-comp small{display:block;font-size:11px;color:#c7d7df}.cpw-face-foot{display:flex;justify-content:center;gap:7px;align-items:center;color:#a9adb6;font-size:10px;margin-top:12px}.cpw-face-foot i{width:4px;height:4px;border-radius:50%;background:#6cd1f9}.cpw-caption{text-align:center;font-size:11px;color:var(--cpw-secondary);margin-top:8px;line-height:1.5}
.cpw-guide h3{font-size:24px;line-height:1.18;letter-spacing:-.6px;margin:0 0 10px}.cpw-guide>p{font-size:14px;line-height:1.55;color:var(--cpw-secondary);margin:0 0 20px;max-width:490px}.cpw-step-list{display:flex;flex-direction:column;gap:7px}.cpw-step{display:flex;gap:12px;align-items:center;text-align:left;border:1px solid transparent;background:none;color:var(--cpw-secondary);border-radius:13px;padding:10px 12px;font-size:13px;min-height:46px}.cpw-step b{height:25px;width:25px;border:1px solid var(--line,#d9e2e9);border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-size:11px;font-weight:600}.cpw-step strong{display:block;font-size:13px;font-weight:650}.cpw-step small{display:block;font-size:11px;margin-top:2px;line-height:1.4}.cpw-step.selected{color:var(--cpw-ink);background:var(--soft,#e8f4fa);border-color:#0faced30}.cpw-step.selected b{color:#fff;background:#007ba8;border-color:#007ba8}.cpw-player{display:flex;gap:9px;align-items:center;margin-top:17px}.cpw-player button{border:1px solid var(--line,#d9e2e9);background:var(--cpw-paper);border-radius:20px;padding:8px 14px;min-height:38px;font-size:12px}.cpw-player .cpw-reset{margin-left:auto;border-color:transparent;color:var(--cpw-secondary)}.cpw-status{font-size:12px;color:var(--cpw-secondary);line-height:1.5;min-height:37px;padding-top:12px}.cpw-status strong{color:var(--cpw-ink)}
.cpw-complications{margin-top:32px}.cpw-section-title{font-size:20px;letter-spacing:-.4px;margin:0 0 8px}.cpw-section-copy{font-size:13px;color:var(--cpw-secondary);margin:0 0 17px;line-height:1.6}.cpw-comp-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}.cpw-comp-card{background:var(--cpw-paper);border:1px solid var(--line,#e2e4e9);border-radius:20px;overflow:hidden}.cpw-comp-stage{height:170px;background:#090b0e;display:flex;align-items:center;justify-content:center;padding:24px;color:#fff}.cpw-comp-stage button{color:#fff;border:0;text-align:left}.cpw-comp-body{padding:17px}.cpw-comp-body h4{margin:0 0 5px;font-size:14px}.cpw-comp-body p{font-size:12px;color:var(--cpw-secondary);line-height:1.55;margin:0}.cpw-comp-circle{width:92px;height:92px;flex-shrink:0;border:6px solid #2d3035!important;box-shadow:inset 0 0 0 1px #49505a;background:#12171c;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center!important}.cpw-comp-circle small{font-size:10px;line-height:1;letter-spacing:.4px;color:#b8c8d2}.cpw-comp-circle strong{font-size:32px;line-height:1.05;color:#71d7ff;font-weight:600}.cpw-comp-inline{font-size:16px;font-weight:550;background:none;min-height:44px;white-space:nowrap;padding:6px}.cpw-comp-inline span{color:#72d7ff}.cpw-comp-rect{padding:11px 12px;width:218px;border-radius:17px;background:#19252c;font-size:13px;line-height:1.3}.cpw-comp-rect strong{display:block;font-size:18px;color:#72d7ff;margin:4px 0}.cpw-comp-rect small{font-size:11px;color:#c0cbd3}.cpw-native-note{margin-top:22px;padding:17px 20px;border:1px solid var(--line,#e2e4e9);border-radius:16px;font-size:12px;color:var(--cpw-secondary);line-height:1.7}.cpw-native-note strong{color:var(--cpw-ink)}.cpw-native-note a{color:var(--blue,#007ba8);text-underline-offset:3px}.cpw-sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.cpw-demo-state .cpw-scenario-label{flex-direction:column;align-items:stretch;gap:6px;font-size:11px;font-weight:600;margin-bottom:10px}.cpw-scenario-label select{font:inherit;font-size:12px;min-height:38px;width:100%;padding:7px;border:1px solid var(--line,#e2e4e9);border-radius:9px;background:var(--cpw-paper);color:var(--cpw-ink)}.cpw-state-box{text-align:center;padding:7px 5px 10px}.cpw-state-box h3{font-size:20px;font-weight:650;line-height:1.2;letter-spacing:-.4px;margin:7px 0 10px}.cpw-state-box p{font-size:13px;line-height:1.45;color:#b8bdc7}.cpw-state-box .cpw-label{font-size:10px}.cpw-state-mark{display:block;width:30px;height:30px;stroke:#56cbfa;fill:none;stroke-width:1.6;stroke-linecap:round;margin:5px auto 10px}.cpw-copy-card{padding:15px 16px;background:var(--group,#f2f2f7);border:1px solid var(--line,#e2e4e9);border-radius:15px;margin:12px 0}.cpw-copy-card>span{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--cpw-secondary);margin-bottom:7px}.cpw-copy-card p{font-size:13px;line-height:1.55;margin:0}.cpw-copy-card.proposed{background:var(--soft,#e8f4fa)}.cpw-single-comp{grid-template-columns:minmax(280px,360px)}
@media(max-width:900px){.cp-watch{padding:16px 24px 30px}.cpw-intro{flex-direction:column}.cpw-demo-state{width:100%}.cpw-flow-layout{gap:20px;padding:20px;grid-template-columns:300px minmax(0,1fr)}.cpw-comp-grid{gap:10px}.cpw-comp-stage{padding:14px}.cpw-comp-inline{font-size:13px}.cpw-comp-body{padding:14px}}
@media(max-width:680px){.cpw-flow-layout{grid-template-columns:1fr;padding:15px}.cpw-device-space{height:405px}.cpw-guide{padding:0 5px 8px}.cpw-guide h3{font-size:22px}.cpw-comp-grid{grid-template-columns:1fr}.cpw-comp-card{display:grid;grid-template-columns:45% 1fr}.cpw-comp-stage{height:155px;min-width:0;padding:12px}.cpw-comp-body{align-self:center}.cpw-comp-rect{font-size:11px}.cpw-comp-rect strong{font-size:15px}.cpw-comp-inline{font-size:11px;white-space:normal}.cpw-intro h2{font-size:29px}.cpw-player{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.cp-watch *{scroll-behavior:auto!important;transition:none!important}}
`;

export function mountWatch(root: HTMLElement): void {
  let view: WatchView = "face";
  let scenario: WatchScenario = "active";
  let detail: WatchEvent = "photo";
  let saved = false;
  let stayFive = false;
  let cueTime = false;
  let notice = "";
  const steps: { view: WatchView; title: string; detail: string }[] = [
    { view: "face", title: "Glance at the complication", detail: "One useful cue on the watch face." },
    { view: "glance", title: "See now, leave time, and next", detail: "Your attendance times, including late joins." },
    { view: "leave", title: "Know when to switch rooms", detail: "A leave cue with the next panel and room." },
    { view: "change", title: "Make one quick adjustment", detail: "Stay 5 minutes, with the tradeoff visible." },
    { view: "today", title: "Scroll the rest of your day", detail: "Three stops, personal times, one vertical list." },
  ];
  const button = (action: string, label: string, kind = "") => `<button class="cpw-watch-button ${kind}" data-watch-action="${action}">${label}</button>`;
  const savedNote = () => saved && scenario !== "empty" ? `<p class="cpw-saved">Saved plan<br>Last updated ${scenario === "upcoming" ? "1 hour" : `${cueTime ? 55 : 48} min`} ago</p>` : "";
  const watchRow = (id: WatchEvent, label: string, current = false) => {
    const item = watchEvents[id];
    const until = id === "photo" ? watchTiming(stayFive).leave : item.until;
    return `<button class="cpw-watch-row ${current ? "current" : ""}" data-watch-detail="${id}"><span class="cpw-label ${current ? "cyan" : ""}">${label}</span><strong>${item.title}</strong><span class="cpw-muted">${watchTime(item.from)}–${watchTime(until)} · ${item.room}</span></button>`;
  };
  function renderWatch(): string {
    const timing = watchTiming(stayFive);
    const now = scenario === "done" ? 1080 : cueTime ? 865 : 858;
    const minutes = timing.leave - now;
    if (scenario !== "active" && view !== "detail" && !(scenario === "done" && view === "today")) {
      const copy = watchScenarioCopy[scenario];
      const mark = '<svg class="cpw-state-mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/></svg>';
      const body = scenario === "upcoming"
        ? `<div class="cpw-state-box"><p class="cpw-label cyan">YOUR NEXT CON</p><h3>Lakeside Fur Con</h3><strong class="cpw-leave-value" style="margin:14px 0 9px">15 <span>days to go</span></strong><p>Sep 18–20</p></div>`
        : `<div class="cpw-state-box">${mark}<h3>${copy.title}</h3><p>${copy.message}</p></div>${scenario === "done" ? button("today", "Today's plan", "secondary") : ""}`;
      return `<div class="cpw-screen"><div class="cpw-watch-bar"><span>${scenario === "upcoming" ? "Coming Up" : "ConPaws"}</span><time>${watchTime(now)}</time></div><div class="cpw-scroll" tabindex="0" aria-label="${copy.title}; scroll to see more">${body}${savedNote()}</div></div>`;
    }
    if (view === "face") return `<div class="cpw-screen cpw-face"><div class="cpw-watch-bar">SAT 19</div><div class="cpw-face-time">${watchTime(now)}</div><button class="cpw-face-comp" data-watch-view="glance" aria-label="Open ConPaws. Leave ${watchTime(timing.leave)}. Character design lab, Cedar, join 2:35 PM."><small>CONPAWS · ${saved ? "SAVED PLAN" : "MY PLAN"}</small><strong>${minutes > 0 ? `Leave in ${minutes} min` : "Leave now"}</strong><span>Cedar · join 2:35</span></button><div class="cpw-face-foot"><i></i><span>${saved ? "Updated 48 min ago" : "Tap your plan to open"}</span></div></div>`;
    const title = { glance: "ConPaws", leave: "Next stop", change: "Leave time", today: "Today", detail: "Panel" }[view];
    const back = view === "detail" ? "today" : view === "change" ? "leave" : view === "glance" ? "face" : "glance";
    let body = "";
    if (view === "glance") body = `${savedNote()}${notice ? `<p class="cpw-confirmation">${notice}</p>` : ""}<div class="cpw-leave-hero"><p class="cpw-label cyan">${minutes > 0 ? "LEAVE IN" : "YOUR LEAVE TIME"}</p><strong class="cpw-leave-value">${minutes > 0 ? `${minutes} <span>min</span>` : "Now"}</strong></div><div class="cpw-watch-current"><strong>Fursuit photography</strong><p>Ballroom A · leave ${watchTime(timing.leave)}</p></div><button class="cpw-watch-row" data-watch-view="leave"><span class="cpw-label cyan">NEXT · JOIN 2:35</span><strong>Character design lab</strong><span class="cpw-muted">Cedar <span aria-hidden="true">›</span></span></button>${button("today", "Today's plan")}<p class="cpw-watch-footnote">Scroll for your day${saved ? ". Schedule changes may be missing." : "."}</p>`;
    if (view === "leave") body = `${savedNote()}<div class="cpw-watch-block"><p class="cpw-label cyan">${stayFive ? "LEAVE AT 2:30" : "TIME TO LEAVE"}</p><h3 class="cpw-room-hero">Cedar</h3><p>Character design lab</p><p class="cpw-tiny cpw-muted" style="margin-top:6px">Your join time · 2:35 PM</p><div class="cpw-mini-map">Ballroom A <span></span> Cedar</div></div>${button("change", "Adjust leave time", "secondary")}${button("today", "Today's plan")}<p class="cpw-watch-footnote">${timing.gap} min between your leave and join times. Check venue signs for directions.</p>`;
    if (view === "change") body = `${savedNote()}<div class="cpw-watch-block"><p class="cpw-label">FURSUIT PHOTOGRAPHY</p><h3 class="cpw-room-hero small">Stay 5 min?</h3></div><div class="cpw-compare" style="padding:8px;margin:4px 0"><p><span>Leave</span><strong>2:25 → 2:30</strong></p><p><span>Join</span><strong>2:35 PM</strong></p></div><p class="cpw-warning">5 min gap · was 10 min</p>${button("stay", stayFive ? "5 minutes already added" : "Stay 5 more min", "primary")}${button("keep", "Keep 2:25 leave time")}<p class="cpw-watch-footnote">This uses 5 min of your transition buffer. It does not change your next join time.${saved ? " Watch edits are a proposed feature; this change stays in the demo." : ""}</p>`;
    if (view === "today") body = `${savedNote()}<div class="cpw-watch-block"><p class="cpw-label">SATURDAY, SEP 19</p><p class="cpw-tiny cpw-muted">Lakeside Fur Con · your plan</p></div>${watchRow("photo", "NOW · LEAVE EARLY", true)}<p class="cpw-watch-gap">${timing.gap} min transition gap</p>${watchRow("draw", "NEXT · JOIN LATE")}${watchRow("story", "LATER")}${button("glance", "Now & next")}<p class="cpw-watch-footnote">Times show when you plan to attend. Tap a panel for official times.</p>`;
    if (view === "today" && scenario === "done") body = `<div class="cpw-watch-block"><p class="cpw-label">SATURDAY, SEP 19</p><p class="cpw-tiny cpw-muted">Three planned panels · all ended</p></div>${watchRow("photo", "EARLIER")}${watchRow("draw", "EARLIER")}${watchRow("story", "EARLIER")}${button("glance", "Back to overview")}${savedNote()}`;
    if (view === "detail") {
      const item = watchEvents[detail];
      const until = detail === "photo" ? timing.leave : item.until;
      body = `${savedNote()}<div class="cpw-watch-block"><h3 class="cpw-room-hero small">${item.title}</h3><p class="cpw-muted">${item.room}</p><div class="cpw-watch-detail"><span class="cpw-label cyan">YOUR ATTENDANCE</span>${watchTime(item.from)}–${watchTime(until)} PM</div><div class="cpw-watch-detail"><span class="cpw-label">OFFICIAL PANEL</span>${item.official}</div></div>${detail === "photo" ? button("change", "Adjust leave time", "secondary") : ""}${button("today", "Today's plan")}<p class="cpw-watch-footnote">${detail === "draw" ? "Joining after the panel starts. Check whether late entry is allowed." : "Attendance times are your plan. The panel schedule is unchanged."}</p>`;
    }
    return `<div class="cpw-screen"><div class="cpw-watch-bar"><button data-watch-view="${back}" aria-label="Back to ${back === "face" ? "watch face" : back === "today" ? "today's plan" : "previous screen"}"><span class="cpw-back" aria-hidden="true">‹</span>${title}</button><time>${watchTime(now)}</time></div><div class="cpw-scroll" tabindex="0" aria-label="${title}; scroll to see more">${body}</div></div>`;
  }
  function render(): void {
    root.classList.add("cp-watch");
    const timing = watchTiming(stayFive);
    const now = scenario === "done" ? 1080 : cueTime ? 865 : 858;
    const minutes = timing.leave - now;
    const step = steps.findIndex(item => item.view === (view === "detail" ? "today" : view));
    root.innerHTML = `<style>${watchCSS}</style><div class="cpw-intro"><div><p class="cpw-kicker">APPLE WATCH · FLOW EXPLORATION</p><h2>Less planning.<br>More being there.</h2><p>Keep the wrist focused on your next move: when to leave, where to go, and a quick adjustment if a panel is too good to leave.</p></div><div class="cpw-demo-state"><label class="cpw-scenario-label">Watch scenario<select data-watch-scenario>${Object.entries(watchScenarios).map(([value, label]) => `<option value="${value}" ${scenario === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>${scenario === "empty" ? "" : `<label><input type="checkbox" data-watch-saved ${saved ? "checked" : ""}>Older saved plan</label>`}<small>Fictional demo · ${scenario === "upcoming" ? "Thu, Sep 3" : "Sat, Sep 19"} · ${watchTime(now)} PM</small></div></div><div class="cpw-flow-layout"><div><div class="cpw-device-space"><div class="cpw-hardware">${renderWatch()}</div></div><p class="cpw-caption">Enlarged 208 × 248 pt reference · scroll inside the watch<br>Browser approximation; Crown and haptics need a real watch.</p></div><div class="cpw-guide"><p class="cpw-kicker">TRY THE WRIST FLOW</p><h3>Two panels.<br>One clear next move.</h3><p>Photography until ${watchTime(timing.leave)}. Character design at 2:35. The official panels overlap, but your planned attendance does not.</p><nav class="cpw-step-list" aria-label="Watch demo steps">${steps.map((item, index) => `<button class="cpw-step ${index === step ? "selected" : ""}" data-watch-view="${item.view}" aria-current="${index === step ? "step" : "false"}"><b>${index + 1}</b><span><strong>${item.title}</strong><small>${item.detail}</small></span></button>`).join("")}</nav><div class="cpw-player"><button data-watch-action="previous" ${step === 0 ? "disabled" : ""}>← Previous</button><button data-watch-action="next" ${step === steps.length - 1 ? "disabled" : ""}>Next →</button><button class="cpw-reset" data-watch-action="reset">Reset demo</button></div><div class="cpw-status" role="status" aria-live="polite">${notice ? `<strong>${notice}</strong> ` : ""}Leave ${watchTime(timing.leave)} · join 2:35 · ${timing.gap} min transition gap.${saved ? " Saved plan; recent schedule changes may be missing." : ""}</div></div></div><section class="cpw-complications" aria-label="Watch complication ideas"><h3 class="cpw-section-title">Useful before you open the app.</h3><p class="cpw-section-copy">Three complication families, each with one clear job. Tap any example to open Now & next.</p><div class="cpw-comp-grid"><article class="cpw-comp-card"><div class="cpw-comp-stage"><button class="cpw-comp-circle" data-watch-complication aria-label="Open Now and next; ${minutes > 0 ? `leave in ${minutes} minutes` : "leave now"}"><small>LEAVE</small><strong>${minutes > 0 ? minutes : "0"}</strong><small>MIN</small></button></div><div class="cpw-comp-body"><h4>Circular · urgency</h4><p>A number with a clear label. No decorative progress ring implying completion.</p></div></article><article class="cpw-comp-card"><div class="cpw-comp-stage"><button class="cpw-comp-inline" data-watch-complication><span>↗</span> Leave ${watchTime(timing.leave)} · Cedar</button></div><div class="cpw-comp-body"><h4>Inline · leave time</h4><p>Time and next room on one line. Face space determines truncation.</p></div></article><article class="cpw-comp-card"><div class="cpw-comp-stage"><button class="cpw-comp-rect" data-watch-complication><small>CONPAWS${saved ? " · SAVED PLAN" : ""}</small><strong>${minutes > 0 ? `Leave in ${minutes} min` : "Leave now"}</strong><span>Character design lab</span><br><small>Join 2:35 · Cedar</small></button></div><div class="cpw-comp-body"><h4>Rectangular · next move</h4><p>Countdown, next panel, room, and join time. Also a starting point for Smart Stack.</p></div></article></div></section><aside class="cpw-native-note"><strong>Native implementation:</strong> watch screens use SwiftUI; complications use SwiftUI and WidgetKit. NativeWind applies to supported React Native views on the phone, not these watch surfaces. Use native vertical scrolling and standard buttons, keep hierarchy shallow, and test Dynamic Type, VoiceOver, small watches, tinted faces, and Always On. <a href="https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos/" target="_blank" rel="noreferrer">watchOS HIG</a> · <a href="https://developer.apple.com/design/human-interface-guidelines/digital-crown" target="_blank" rel="noreferrer">Digital Crown</a> · <a href="https://developer.apple.com/design/human-interface-guidelines/complications" target="_blank" rel="noreferrer">Complications</a> · <a href="https://developer.apple.com/documentation/widgetkit/creating-accessory-widgets-and-watch-complications" target="_blank" rel="noreferrer">WidgetKit</a></aside>`;
    if (stayFive) root.querySelector<HTMLButtonElement>('[data-watch-action="stay"]')?.setAttribute("disabled", "");
    root.querySelector(".cpw-native-note")?.insertAdjacentHTML("afterbegin", '<strong>Proposal boundary:</strong> The current watch app is read-only and its widget supports the rectangular family. Quick edits, circular and inline complications, and the revised empty-state wording here are proposals. <br>');
    if (scenario !== "active") {
      const copy = watchScenarioCopy[scenario];
      root.querySelector(".cpw-intro h2")!.textContent = "A clear next step.";
      root.querySelector(".cpw-intro > div:first-child > p:last-child")!.textContent = "The watch should tell you what is saved, what comes next, and when to use your iPhone.";
      root.querySelector(".cpw-guide")!.innerHTML = `<p class="cpw-kicker">WATCH STATE · COPY EXPLORATION</p><h3>${copy.title}</h3><p>${copy.condition}</p><div class="cpw-copy-card"><span>Current watch wording</span><p>${copy.current}</p></div><div class="cpw-copy-card proposed"><span>Why this wording</span><p>${copy.idea}</p></div><div class="cpw-status" role="status" aria-live="polite">${notice || (scenario === "upcoming" ? "Sample date: September 3, 2026. Con starts September 18: 15 calendar days away." : scenario === "done" ? "Sample time: 6:00 PM. The last chosen panel ended at 5:00 PM." : "Sample state is local to this watch preview.")}</div><div class="cpw-player"><button data-watch-action="reset">Try the active plan →</button></div>`;
      root.querySelector(".cpw-complications")!.innerHTML = `<h3 class="cpw-section-title">The same state, at a glance.</h3><p class="cpw-section-copy">Rectangular complication proposal. Tap to open this state in the watch app.</p><div class="cpw-comp-grid cpw-single-comp"><article class="cpw-comp-card"><div class="cpw-comp-stage"><button class="cpw-comp-rect" data-watch-complication aria-label="Open ConPaws: ${copy.title}"><small>${scenario === "empty" ? "CONPAWS" : "LAKESIDE FUR CON"}</small><strong>${copy.compact}</strong><small>${copy.secondary}</small></button></div><div class="cpw-comp-body"><h4>Rectangular · ${scenario === "upcoming" ? "countdown" : "next step"}</h4><p>${scenario === "empty" ? "A phone instruction, not a button that launches the iPhone app." : scenario === "done" ? "Shown only after every chosen panel has ended." : scenario === "no-picks" ? "An empty personal plan does not tell us whether a program is published." : "Date-based countdown. No invented opening time."}</p></div></article></div>`;
      if (scenario === "done") root.querySelector('[data-watch-action="change"]')?.remove();
    }
  }
  function show(next: WatchView): void {
    view = next;
    notice = "";
    if (next === "leave" || next === "change") cueTime = true;
    if (next === "face") cueTime = false;
  }
  root.onclick = event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>("[data-watch-view],[data-watch-action],[data-watch-detail],[data-watch-complication]");
    if (!control || !root.contains(control)) return;
    if (control.hasAttribute("data-watch-view")) show(control.dataset.watchView as WatchView);
    else if (control.hasAttribute("data-watch-detail")) { detail = control.dataset.watchDetail as WatchEvent; show("detail"); }
    else if (control.hasAttribute("data-watch-complication")) {
      show("glance");
      if (scenario !== "active") notice = `Opened ConPaws: ${watchScenarioCopy[scenario].title}.`;
    }
    else {
      const action = control.dataset.watchAction;
      if (action === "next" || action === "previous") {
        const index = steps.findIndex(item => item.view === (view === "detail" ? "today" : view));
        const next = steps[index + (action === "next" ? 1 : -1)];
        if (next) show(next.view);
      } else if (action === "stay" || action === "keep") {
        stayFive = action === "stay";
        view = "glance";
        cueTime = true;
        notice = `${stayFive ? "Leave time moved to 2:30." : "Leave time kept at 2:25."} Updated in this demo.`;
      } else if (action === "reset") {
        stayFive = false; saved = false; cueTime = false; notice = ""; view = "face"; scenario = "active";
      } else if (action === "today" || action === "glance" || action === "change") show(action);
    }
    const bringWatchIntoView = control.hasAttribute("data-watch-complication");
    const focusWithinWatch = Boolean(control.closest(".cpw-screen"));
    render();
    if (bringWatchIntoView) root.querySelector(".cpw-flow-layout")?.scrollIntoView({ behavior: "auto", block: "start" });
    if (focusWithinWatch || bringWatchIntoView) root.querySelector<HTMLElement>(".cpw-scroll, .cpw-face-comp")?.focus({ preventScroll: true });
    else {
      const action = control.dataset.watchAction;
      const nextControl = action ? root.querySelector<HTMLElement>(`[data-watch-action="${action}"]:not(:disabled)`) : null;
      (nextControl ?? root.querySelector<HTMLElement>(".cpw-step.selected"))?.focus({ preventScroll: true });
    }
  };
  root.onchange = event => {
    if (event.target instanceof HTMLSelectElement && event.target.hasAttribute("data-watch-scenario")) {
      if (!Object.hasOwn(watchScenarios, event.target.value)) return;
      scenario = event.target.value as WatchScenario;
      view = scenario === "active" ? "face" : "glance";
      stayFive = false; cueTime = false; notice = "";
      if (scenario === "empty") saved = false;
      render();
      root.querySelector<HTMLSelectElement>("[data-watch-scenario]")?.focus({ preventScroll: true });
      return;
    }
    if (!(event.target instanceof HTMLInputElement) || !event.target.hasAttribute("data-watch-saved")) return;
    saved = event.target.checked;
    notice = "";
    render();
    root.querySelector<HTMLInputElement>("[data-watch-saved]")?.focus({ preventScroll: true });
  };
  render();
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const original = watchTiming(false);
  const delayed = watchTiming(true);
  if (original.leave !== 865 || original.gap !== 10 || delayed.leave !== 870 || delayed.gap !== 5 || delayed.join !== original.join || delayed.join - delayed.leave !== delayed.gap) {
    throw new Error("Watch leave adjustment must consume five minutes of the transition gap without moving the join time.");
  }
  const pastPicks = Object.values(watchEvents);
  if (pastPicks.length === 0 || pastPicks.some(item => item.until > 1080) || (Date.UTC(2026, 8, 18) - Date.UTC(2026, 8, 3)) / 86_400_000 !== 15) {
    throw new Error("Watch scenario fixtures must have 15 days until the convention and known completed picks at 6 PM.");
  }
  console.log("Watch timing self-check passed: leave 2:25 → 2:30, join 2:35, gap 10 → 5 minutes.");
}
