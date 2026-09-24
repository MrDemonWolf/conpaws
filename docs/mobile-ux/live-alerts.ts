type AlertTone = "short" | "friendly";
type AlertCopy = { title: string; body: string };
type ActivityState = "upcoming" | "current" | "leave" | "finished";

export const liveAlertScenarios = {
  upcoming: {
    label: "Upcoming panel", clock: "1:50 PM", channel: "Event reminders",
    context: "10 minutes before the organizer's 2:00 PM start. You chose a start reminder.",
    short: { title: "Photography Starts Soon", body: "Fursuit photography starts at 2:00 PM in Ballroom A." },
    friendly: { title: "Photography Starts Soon", body: "Your next panel is Fursuit photography, at 2:00 PM in Ballroom A." },
  },
  leave: {
    label: "Your leave time", clock: "2:25 PM", channel: "Plan reminders",
    context: "Your saved leave time is due. The panel itself continues until 3:00 PM.",
    short: { title: "Your Leave Time Is Now", body: "You planned to leave photography at 2:25 PM. Join Character design at 2:35 PM in Cedar." },
    friendly: { title: "Ready for Your Next Panel?", body: "You chose to leave photography at 2:25 PM. Character design is next, at 2:35 PM in Cedar." },
  },
  joining: {
    label: "Joining a panel late", clock: "2:35 PM", channel: "Plan reminders",
    context: "Your personal attendance starts now. The organizer's panel started at 2:00 PM.",
    short: { title: "Join Character Design", body: "Your plan starts at 2:35 PM in Cedar. This panel has been running since 2:00 PM." },
    friendly: { title: "Time for Character Design", body: "You planned to join at 2:35 PM in Cedar. The panel started at 2:00 PM, so you are joining partway through." },
  },
  moved: {
    label: "Organizer changes room", clock: "2:20 PM", channel: "Schedule changes",
    context: "Separate what the organizer changed from the time you chose. Fictional room-change scenario.",
    short: { title: "Character Design Moved", body: "The organizer moved Character design from Cedar to Maple. Your join time is still 2:35 PM." },
    friendly: { title: "A New Room for Your Panel", body: "Character design is now in Maple instead of Cedar. Your planned join time is still 2:35 PM." },
  },
  cancelled: {
    label: "Organizer cancels panel", clock: "2:20 PM", channel: "Schedule changes",
    context: "Keep the cancelled entry visible until reviewed. Never replace someone's choice automatically.",
    short: { title: "Character Design Cancelled", body: "The organizer cancelled Character design. Review your 2:35 PM plan to choose another panel." },
    friendly: { title: "Character Design Cancelled", body: "The organizer cancelled this panel. You can review your 2:35 PM plan and pick something else." },
  },
  overlap: {
    label: "Unresolved overlap", clock: "1:30 PM", channel: "Plan reminders",
    context: "Alternative example: both full panels are saved and attendance times are unresolved. Send only if requested.",
    short: { title: "Two Plans Overlap", body: "Photography and Character design overlap in your plan. Choose attendance times or keep both as options." },
    friendly: { title: "Two Panels, One Time Slot", body: "Still choosing between photography and Character design? Set your attendance times, or keep both as options." },
  },
  test: {
    label: "Test notification", clock: "2:18 PM", channel: "Event reminders",
    context: "Review wording for a user-requested test. This browser preview does not request permission or send notifications.",
    short: { title: "Test Reminder", body: "This is a test reminder from ConPaws." },
    friendly: { title: "A Little Reminder Test", body: "This is your ConPaws test reminder. You can adjust reminders in Settings." },
  },
} satisfies Record<string, { label: string; clock: string; channel: string; context: string; short: AlertCopy; friendly: AlertCopy }>;

export const liveActivitySamples = {
  upcoming: { clock: "1:50", label: "Starts in", value: "10", unit: "min", compact: "10m", title: "Fursuit photography", room: "Ballroom A", instruction: "Starts at 2:00 PM", next: "Your plan: 2:00–2:25 PM", footer: "Then Character design · 2:35 PM · Cedar", progress: 0, context: "Sample time 1:50 PM. You chose to track this afternoon's plan." },
  current: { clock: "2:18", label: "Leave in", value: "7", unit: "min", compact: "7m", title: "Fursuit photography", room: "Ballroom A", instruction: "Your leave time · 2:25 PM", next: "Next · Character design", footer: "Join at 2:35 PM · Cedar", progress: 72, context: "Sample time 2:18 PM. Leave time is yours; the panel continues until 3:00 PM." },
  leave: { clock: "2:25", label: "Your leave time", value: "Now", unit: "2:25 PM", compact: "Now", title: "Fursuit photography", room: "Ballroom A", instruction: "You planned to leave now", next: "Next · Character design", footer: "Join at 2:35 PM · Cedar", progress: 100, context: "Sample time advances to 2:25 PM. This is the leave time you saved, not a walking-time estimate." },
  finished: { clock: "3:20", label: "Your plan", value: "Done", unit: "3:20 PM", compact: "✓", title: "Afternoon plan finished", room: "Your attendance ended at 3:20 PM", instruction: "Character design continues until 3:30 PM", next: "Next · Storytelling", footer: "4:00–5:00 PM · See your plan", progress: 100, context: "Sample time 3:20 PM. End this Live Activity; a later panel gets its own reminder." },
} satisfies Record<ActivityState, { clock: string; label: string; value: string; unit: string; compact: string; title: string; room: string; instruction: string; next: string; footer: string; progress: number; context: string }>;

const escapeLiveText = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const paw = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="6" cy="8" rx="2.3" ry="3" transform="rotate(-25 6 8)"/><ellipse cx="11" cy="5.5" rx="2.3" ry="3"/><ellipse cx="16.3" cy="6.5" rx="2.3" ry="3" transform="rotate(20 16.3 6.5)"/><ellipse cx="20" cy="11" rx="2" ry="2.8" transform="rotate(30 20 11)"/><path d="M6.8 15.2c1.6-1.6 2.5-4.1 5-4.1s3.6 2.4 5.2 4c2.7 2.8.6 6-2 5.4-2.1-.5-3.7-.5-5.8 0-3 .7-5-2.6-2.4-5.3Z"/></svg>`;

const liveStyles = `
.live-gallery{--live-ink:#111d32;--live-muted:#647084;--live-line:#dde3e9;--live-blue:#006f99;color:var(--live-ink);padding:76px 0 24px;scroll-margin-top:90px;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.live-gallery *{box-sizing:border-box}.live-gallery button,.live-gallery input,.live-gallery textarea,.live-gallery select{font:inherit}.live-gallery button{cursor:pointer}.live-gallery button:focus-visible,.live-gallery input:focus-visible,.live-gallery select:focus-visible,.live-gallery textarea:focus-visible,.live-gallery a:focus-visible{outline:3px solid #0088b8;outline-offset:4px}.live-gallery button{border:0}.live-gallery h2,.live-gallery h3,.live-gallery p{margin:0}.live-gallery h2{font-size:34px;letter-spacing:-1.25px;font-weight:700;line-height:1.12}.live-gallery h3{font-size:18px;letter-spacing:-.3px}.live-gallery .live-eyebrow{font-size:10px;font-weight:750;letter-spacing:1.7px;text-transform:uppercase;color:var(--live-blue);margin-bottom:12px}.live-gallery .live-intro{font-size:15px;line-height:1.6;max-width:710px;color:var(--live-muted);margin-top:13px}.live-gallery .live-section-top{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:28px}.live-gallery .live-native-tag{background:#e6f2f7;border:1px solid #d2e7ee;border-radius:99px;padding:8px 13px;white-space:nowrap;font-size:11px;font-weight:650;color:#17627c}.live-gallery .live-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:24px 0 17px}.live-gallery .live-segment{display:inline-flex;gap:3px;border-radius:11px;background:#e5e8ed;padding:3px}.live-gallery .live-segment button{min-height:40px;background:transparent;border-radius:8px;padding:8px 15px;font-size:13px;color:#526076;font-weight:600}.live-gallery .live-segment button[aria-pressed=true]{background:white;color:#102236;box-shadow:0 1px 4px #112b491c}.live-gallery .live-context{font-size:12px;line-height:1.5;color:var(--live-muted);max-width:460px}.live-gallery .live-surfaces{display:grid;grid-template-columns:minmax(340px,.9fr) minmax(420px,1.1fr);gap:26px;align-items:stretch}.live-gallery .live-artboard{border:1px solid var(--live-line);background:#ecf0f4;border-radius:22px;padding:25px;min-width:0}.live-gallery .live-art-label{font-size:10px;letter-spacing:1.25px;text-transform:uppercase;color:#687b8d;font-weight:700;margin-bottom:20px;display:flex;justify-content:space-between;gap:10px}.live-gallery .live-lockscreen{position:relative;margin:0 auto;max-width:360px;min-height:458px;overflow:hidden;border-radius:45px;border:7px solid #1b222b;background:radial-gradient(ellipse at 5% 25%,#48939f 0,transparent 60%),radial-gradient(ellipse at 95% 95%,#5579a9 0,transparent 70%),linear-gradient(145deg,#15334a,#284a64 65%,#4f6984);box-shadow:0 15px 30px #14274320;color:#e8f3fb;padding:22px 14px 25px;display:flex;flex-direction:column;align-items:center}.live-gallery .live-sensor{width:97px;height:27px;background:#080a0e;border-radius:20px;margin:-12px auto 22px}.live-gallery .live-lock-date{font-size:17px;font-weight:580;color:#e0edf4}.live-gallery .live-lock-clock{font-size:78px;font-weight:650;letter-spacing:-4px;line-height:1.04;font-variant-numeric:tabular-nums}.live-gallery .live-lock-hint{font-size:11px;margin-top:10px;color:#dae8ee}.live-gallery .live-lock-activity{margin-top:41px;display:block;text-align:left;width:100%;border-radius:23px;padding:15px 16px;color:#f5f8fc;background:#0c1828d9;backdrop-filter:blur(14px);box-shadow:0 4px 12px #00000012}.live-gallery .live-activity-brand{display:flex;gap:6px;align-items:center;font-size:11px;color:#b8cbd9;margin-bottom:12px}.live-gallery .live-activity-brand svg{width:16px;height:16px;color:#69d1f3}.live-gallery .live-activity-main{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start}.live-gallery .live-activity-title{font-size:16px;font-weight:650;letter-spacing:-.3px;line-height:1.22}.live-gallery .live-activity-room{font-size:12px;color:#b8c6d3;margin-top:4px;line-height:1.3}.live-gallery .live-count{text-align:right;color:#83dcf6;min-width:58px}.live-gallery .live-count small{display:block;font-size:10px;line-height:1.2;color:#b7dce7;margin-bottom:3px}.live-gallery .live-count strong{font-size:29px;letter-spacing:-1px;font-variant-numeric:tabular-nums;line-height:1}.live-gallery .live-count span{display:block;font-size:10px;margin-top:3px;line-height:1.25;color:#c4d3dd}.live-gallery .live-progress{height:3px;background:#d7e7fa22;border-radius:4px;overflow:hidden;margin:15px 0 11px}.live-gallery .live-progress span{display:block;height:100%;background:#73d7f4;border-radius:4px}.live-gallery .live-next{font-size:12px;font-weight:550;line-height:1.4}.live-gallery .live-next small{display:block;color:#b8c6d3;font-size:11px;font-weight:400}.live-gallery .live-lock-home{height:4px;width:110px;border-radius:9px;background:#fff9;margin-top:auto;transform:translateY(15px)}.live-gallery .live-spec-note{max-width:365px;margin:16px auto 0;font-size:11px;line-height:1.5;color:var(--live-muted)}.live-gallery .live-island-board{display:flex;flex-direction:column;gap:23px;background:#f7f9fa}.live-gallery .live-island-board .live-art-label{margin-bottom:0}.live-gallery .live-island-pair{display:flex;gap:23px;align-items:center;justify-content:center;padding:0 0 3px}.live-gallery .live-island-label{font-size:10px;color:#6b7c8e;text-align:center;margin-top:9px}.live-gallery .live-compact{display:flex;align-items:center;justify-content:space-between;width:238px;height:39px;border-radius:35px;background:#000;color:#91e0f8;padding:0 12px}.live-gallery .live-compact svg{width:19px;height:19px}.live-gallery .live-compact strong{font-size:13px;font-weight:650;min-width:32px;text-align:right}.live-gallery .live-minimal{display:flex;align-items:center;justify-content:center;min-width:39px;height:39px;padding:0 8px;border-radius:30px;background:#000;color:#91e0f8;font-size:12px;font-weight:600}.live-gallery .live-expanded{display:block;text-align:left;width:min(100%,368px);border-radius:37px;background:#000;color:#fff;padding:20px 22px;margin:auto}.live-gallery .live-expanded-top{display:flex;justify-content:space-between;align-items:start;gap:30px}.live-gallery .live-expanded .live-activity-brand{max-width:160px;align-items:start;line-height:1.3}.live-gallery .live-expanded .live-count strong{font-size:28px}.live-gallery .live-expanded-title{font-size:17px;font-weight:650;margin-top:6px;letter-spacing:-.3px}.live-gallery .live-expanded .live-next{margin-top:12px;padding-top:11px;border-top:1px solid #292b30}.live-gallery .live-android-block{margin-top:auto;border-top:1px solid var(--live-line);padding-top:19px}.live-gallery .live-android-card{border:1px solid #dce4e8;background:#eaf1f4;border-radius:24px;padding:15px 18px;max-width:380px;margin:0 auto;color:#1a2930}.live-gallery .live-android-head{display:flex;align-items:center;gap:7px;font-size:10px;color:#506570;margin-bottom:8px}.live-gallery .live-android-head svg{width:16px;height:16px;color:#25718c;flex-shrink:0}.live-gallery .live-android-title{font-size:14px;font-weight:650;line-height:1.4}.live-gallery .live-android-body{font-size:12px;line-height:1.5;color:#475c67;margin-top:2px}.live-gallery .live-android-actions{display:flex;gap:19px;margin-top:7px;flex-wrap:wrap}.live-gallery .live-android-actions button{background:transparent;color:#006482;padding:7px 0;min-height:36px;font-size:12px;font-weight:650}.live-gallery .live-notification-section{margin-top:57px;padding-top:37px;border-top:1px solid var(--live-line)}.live-gallery .live-copy-grid{display:grid;grid-template-columns:minmax(300px,.85fr) minmax(350px,1.15fr);gap:27px;align-items:start}.live-gallery .live-editor{border:1px solid var(--live-line);background:white;border-radius:20px;padding:24px}.live-gallery .live-field{display:block;margin:0 0 19px;font-size:12px;font-weight:650}.live-gallery .live-field input,.live-gallery .live-field textarea,.live-gallery .live-field select{display:block;width:100%;border:1px solid #cdd6e0;border-radius:9px;padding:11px 12px;background:#fff;color:#152033;line-height:1.4;font-size:14px;margin-top:8px}.live-gallery .live-field select{min-height:44px}.live-gallery .live-field textarea{min-height:116px;resize:vertical}.live-gallery .live-field small{display:block;font-weight:400;color:#66778b;font-size:11px;line-height:1.4;margin-top:6px}.live-gallery .live-field .live-copy-count{float:right;font-size:10px;color:#6b7b8c;font-weight:400}.live-gallery .live-editor .live-segment{display:flex;width:fit-content;margin-bottom:19px}.live-gallery .live-editor .live-context{padding:11px 12px;background:#f0f5f8;border-radius:9px;margin-bottom:20px;font-size:11px}.live-gallery .live-preview-submit{width:100%;min-height:44px;background:#00749f;color:white;border-radius:11px;font-size:14px;font-weight:650}.live-gallery .live-preview-status{font-size:11px;color:#537283;line-height:1.5;margin-top:10px;min-height:32px}.live-gallery .live-preview-controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-size:12px;color:#586b7c;margin-bottom:17px}.live-gallery .live-preview-controls label{display:flex;align-items:center;gap:7px;min-height:32px;cursor:pointer}.live-gallery .live-preview-controls input{width:16px;height:16px;accent-color:#007ca8}.live-gallery .live-notification-stage{border-radius:20px;padding:22px;background:linear-gradient(125deg,#d7e4eb,#eff0f3);min-width:0}.live-gallery .live-notification-stage + .live-notification-stage{margin-top:20px;background:#eef2f4}.live-gallery .live-notification-stage .live-art-label{margin-bottom:16px}.live-gallery .live-ios-alert{width:100%;max-width:385px;margin:0 auto;border-radius:23px;background:#ffffffcf;backdrop-filter:blur(12px);padding:14px 15px;box-shadow:0 5px 15px #1f46640a;display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;min-width:0;color:#121b29}.live-gallery .live-app-icon{width:32px;height:32px;object-fit:cover;border-radius:8px}.live-gallery .live-alert-app{display:flex;gap:10px;align-items:center;justify-content:space-between;font-size:11px;color:#687585;margin-bottom:5px}.live-gallery .live-alert-app strong{font-weight:500;color:#455365}.live-gallery .live-alert-title{font-size:14px;font-weight:650;line-height:1.3;overflow-wrap:anywhere}.live-gallery .live-alert-body{font-size:13px;line-height:1.4;margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere}.live-gallery .live-alert-android{max-width:385px;margin:0 auto;background:#e2edf1;border-radius:24px;padding:15px 17px;color:#1d303a;min-width:0}.live-gallery .live-alert-android .live-alert-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.live-gallery .live-alert-android .live-android-head{gap:5px}.live-gallery .live-alert-android .live-alert-body{color:#415763}.live-gallery .live-collapsed .live-alert-body{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.live-gallery .live-collapsed .live-alert-android .live-alert-body{-webkit-line-clamp:1}.live-gallery .live-large-copy .live-alert-title{font-size:19px}.live-gallery .live-large-copy .live-alert-body{font-size:18px}.live-gallery .live-guidance{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:27px;padding-top:22px;border-top:1px solid var(--live-line)}.live-gallery .live-guidance strong{font-size:12px;display:block;margin-bottom:5px}.live-gallery .live-guidance p{font-size:11px;line-height:1.6;color:#607389}.live-gallery .live-references{display:flex;flex-wrap:wrap;gap:9px 20px;font-size:11px;line-height:1.4;margin-top:21px}.live-gallery .live-references a{color:#35718b;text-underline-offset:3px}.live-gallery .live-dialog{border:1px solid #d9e0e8;border-radius:23px;max-width:410px;width:calc(100% - 36px);padding:25px;color:#132133;box-shadow:0 20px 80px #09153344}.live-gallery .live-dialog::backdrop{background:#0c17265c;backdrop-filter:blur(3px)}.live-gallery .live-dialog header{display:flex;align-items:start;justify-content:space-between;gap:20px}.live-gallery .live-dialog-close{border-radius:99px;background:#edf1f5;width:38px;height:38px;min-width:38px;font-size:18px}.live-gallery .live-dialog p{font-size:13px;line-height:1.6;color:#647184;margin:15px 0}.live-gallery .live-plan-row{padding:14px 0;border-top:1px solid #e3e7ed;font-size:13px;line-height:1.5}.live-gallery .live-plan-row strong{display:block;color:#12263c}.live-gallery .live-plan-row span{display:block;color:#006f96;font-weight:600}.live-gallery .live-plan-row small{color:#667488;font-size:11px}.live-gallery .live-preview-meta{max-width:385px;margin:13px auto 0;color:#6a7b8d;font-size:10px;line-height:1.5}
@media(max-width:1000px){.live-gallery .live-surfaces{grid-template-columns:1fr 1fr;gap:18px}.live-gallery .live-artboard{padding:20px 14px}.live-gallery .live-island-pair{gap:12px}.live-gallery .live-compact{width:211px}.live-gallery .live-copy-grid{gap:20px}.live-gallery .live-section-top{align-items:start}.live-gallery .live-native-tag{display:none}}
@media(max-width:760px){.live-gallery{padding-top:49px}.live-gallery h2{font-size:29px}.live-gallery .live-surfaces,.live-gallery .live-copy-grid{grid-template-columns:1fr}.live-gallery .live-artboard{padding:22px}.live-gallery .live-island-board{gap:22px}.live-gallery .live-compact{width:238px}.live-gallery .live-guidance{grid-template-columns:1fr;gap:16px}.live-gallery .live-section-top{display:block}.live-gallery .live-toolbar{display:block}.live-gallery .live-toolbar .live-context{margin-top:12px}.live-gallery .live-segment button{padding:8px 11px;font-size:12px}.live-gallery .live-notification-stage{padding:20px 13px}.live-gallery .live-notification-section{margin-top:35px}}
@media(prefers-reduced-motion:reduce){.live-gallery *{scroll-behavior:auto!important}}
`;

export function mountLiveAlerts(root: HTMLElement): void {
  root.classList.add("live-gallery");
  let activityState: ActivityState = "current";
  let androidStopped = false;
  let scenario: keyof typeof liveAlertScenarios = "leave";
  let tone: AlertTone = "short";
  const drafts = new Map<string, AlertCopy>();
  let preview = { ...liveAlertScenarios[scenario][tone] };
  let hideContent = false;
  let largeText = false;
  let collapsed = false;

  root.innerHTML = `<style>${liveStyles}</style>
    <div class="live-section-top"><div><p class="live-eyebrow">Live Activities & notifications</p><h2>The next move, at a glance.</h2><p class="live-intro">A glance tells you where you are going and when you chose to leave. These examples use a separate sample plan; edits in Phone flow do not change them.</p></div><span class="live-native-tag">System surfaces · Native first</span></div>
    <div class="live-toolbar"><div class="live-segment" role="group" aria-label="Live Activity scenario">${([['upcoming','Upcoming'],['current','In a panel'],['leave','Leave time'],['finished','Finished']] as const).map(([key,label]) => `<button type="button" data-live-state="${key}" aria-pressed="${key === activityState}">${label}</button>`).join("")}</div><p class="live-context" data-live-context></p></div>
    <div class="live-surfaces" data-live-surfaces></div>
    <section class="live-notification-section" aria-label="Notification copy playground">
      <div class="live-section-top"><div><p class="live-eyebrow">Copy playground</p><h2>Helpful words. No unnecessary rush.</h2><p class="live-intro">Try each moment, edit the wording, then preview both platforms. Short and friendly versions keep the same facts.</p></div></div>
      <div class="live-copy-grid"><form class="live-editor" data-live-editor>
        <label class="live-field">Moment<select data-live-scenario>${Object.entries(liveAlertScenarios).map(([key,value]) => `<option value="${key}" ${key === scenario ? "selected" : ""}>${value.label}</option>`).join("")}</select></label>
        <div class="live-segment" role="group" aria-label="Notification tone"><button type="button" data-live-tone="short" aria-pressed="true">Short</button><button type="button" data-live-tone="friendly" aria-pressed="false">Friendly</button></div>
        <p class="live-context" data-live-copy-context></p>
        <label class="live-field">Title <span class="live-copy-count" data-live-title-count></span><input data-live-title aria-describedby="live-title-help" required><small id="live-title-help">Aim for 30 characters or fewer. Put key words first.</small></label>
        <label class="live-field">Message <span class="live-copy-count" data-live-body-count></span><textarea data-live-body required></textarea><small>Give the time, room, and next step. Let the system handle truncation.</small></label>
        <button class="live-preview-submit" type="submit">Preview notification</button><p class="live-preview-status" data-live-status role="status" aria-live="polite">Browser preview only. Nothing sent to a device.</p>
      </form><div><div class="live-preview-controls"><label><input type="checkbox" data-live-hide>Hide content</label><label><input type="checkbox" data-live-large>Larger text</label><label><input type="checkbox" data-live-collapse>Collapsed</label></div><div data-live-notifications></div></div></div>
      <div class="live-guidance"><div><strong>“Leave” means your leave time</strong><p>A start reminder says when the panel starts. A leave reminder uses the time you chose. No travel estimate is implied.</p></div><div><strong>One reminder for the moment</strong><p>Combine simultaneous plan reminders. Keep schedule changes separate. Saved alternatives stay quiet unless you request a reminder.</p></div><div><strong>Keep details private</strong><p>Hidden previews remove panel titles and rooms. Device settings decide whether a notification shows, sounds, or appears on your Watch.</p></div></div>
      <div class="live-references"><a href="https://developer.apple.com/design/human-interface-guidelines/live-activities" target="_blank" rel="noreferrer">Apple Live Activities ↗</a><a href="https://developer.apple.com/design/human-interface-guidelines/notifications" target="_blank" rel="noreferrer">Apple notification wording ↗</a><a href="https://developer.android.com/design/ui/mobile/guides/home-screen/notifications" target="_blank" rel="noreferrer">Android notification patterns ↗</a></div>
    </section>
    <dialog class="live-dialog" data-live-plan-dialog aria-labelledby="live-plan-title"><header><div><p class="live-eyebrow">Lakeside Fur Con · Sat, Sep 19</p><h3 id="live-plan-title">Your afternoon plan</h3></div><button class="live-dialog-close" type="button" data-live-close-dialog aria-label="Close plan">×</button></header><p>Two panels, with attendance times you chose.</p><div class="live-plan-row"><strong>Fursuit photography · Ballroom A</strong><span>You attend 2:00–2:25 PM</span><small>Organizer's schedule: 2:00–3:00 PM</small></div><div class="live-plan-row"><strong>Between panels</strong><span>2:25–2:35 PM · 10 minutes free</span><small>This gap is not a verified walking-time estimate.</small></div><div class="live-plan-row"><strong>Character design · Cedar</strong><span>You attend 2:35–3:20 PM</span><small>Organizer's schedule: 2:00–3:30 PM<br>Joining late depends on the panel's entry rules.</small></div><div class="live-plan-row"><strong>Storytelling</strong><span>4:00–5:00 PM</span></div><p>Sample plan preview. No organizer times or personal plans were changed.</p></dialog>`;

  function renderActivities() {
    const sample = liveActivitySamples[activityState];
    root.querySelector<HTMLElement>("[data-live-context]")!.textContent = sample.context;
    root.querySelectorAll<HTMLButtonElement>("[data-live-state]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.liveState === activityState)));
    const count = `<div class="live-count"><small>${sample.label}</small><strong>${sample.value}</strong><span>${sample.unit}</span></div>`;
    const progress = `<div class="live-progress" aria-hidden="true"><span style="width:${sample.progress}%"></span></div>`;
    root.querySelector<HTMLElement>("[data-live-surfaces]")!.innerHTML = `<article class="live-artboard"><div class="live-art-label"><span>iPhone · Lock Screen</span><span>Live Activity</span></div><div class="live-lockscreen"><div class="live-sensor" aria-hidden="true"></div><div class="live-lock-date">Saturday, September 19</div><div class="live-lock-clock">${sample.clock}</div><p class="live-lock-hint">Lakeside Fur Con</p><button type="button" class="live-lock-activity" data-live-open-plan aria-label="Preview your afternoon plan"><div class="live-activity-brand">${paw} ConPaws · My plan</div><div class="live-activity-main"><div><div class="live-activity-title">${sample.title}</div><div class="live-activity-room">${sample.room}</div></div>${count}</div>${progress}<div class="live-next">${sample.next}<small>${sample.footer}</small></div></button><div class="live-lock-home" aria-hidden="true"></div></div><p class="live-spec-note">${activityState === "finished" ? "Final state before dismissal. The plan ended; the organizer's panel may continue." : "Tap the activity to preview your attendance plan. One activity follows this short run of panels."}</p></article>
      <article class="live-artboard live-island-board"><div class="live-art-label"><span>iPhone · Dynamic Island</span><span>One plan, three presentations</span></div><div class="live-island-pair"><div><button type="button" class="live-compact" data-live-open-plan aria-label="${sample.label}: ${sample.value} ${sample.unit}. Preview plan">${paw}<strong>${sample.compact}</strong></button><div class="live-island-label">Compact</div></div><div><button type="button" class="live-minimal" data-live-open-plan aria-label="${sample.label}: ${sample.value} ${sample.unit}. Preview plan">${sample.compact}</button><div class="live-island-label">Minimal</div></div></div><div><button type="button" class="live-expanded" data-live-open-plan aria-label="Preview expanded activity and your plan"><div class="live-expanded-top"><div class="live-activity-brand">${paw}<span>${sample.instruction}</span></div>${count}</div><div class="live-expanded-title">${sample.title}</div><div class="live-activity-room">${sample.room}</div><div class="live-next">${sample.next}<small>${sample.footer}</small></div></button><div class="live-island-label">Expanded · key context stays close to the camera</div></div><div class="live-android-block"><div class="live-art-label"><span>Android</span><span>${activityState === "upcoming" || activityState === "finished" ? "Standard notification" : "Active plan notification"}</span></div><div class="live-android-card"><div class="live-android-head">${paw}<span>ConPaws · ${sample.clock} PM</span></div><div class="live-android-title">${androidStopped ? "Plan updates stopped" : activityState === "finished" ? "Your afternoon plan is finished" : activityState === "upcoming" ? "Photography starts at 2:00 PM" : "Photography · leave at 2:25 PM"}</div><div class="live-android-body">${androidStopped ? "Your saved attendance times are unchanged." : sample.footer}</div><div class="live-android-actions"><button type="button" data-live-open-plan>View plan</button>${activityState === "current" || activityState === "leave" ? `<button type="button" data-live-stop-android>${androidStopped ? "Preview updates" : "Stop updates"}</button>` : ""}</div></div><p class="live-spec-note">${androidStopped ? "Preview only. Re-enable updates to compare the active state." : "Android uses its own notification template. This example assumes you chose to track this plan; system presentation can vary."}</p></div></article>`;
  }

  function updateCounts() {
    const title = root.querySelector<HTMLInputElement>("[data-live-title]")!.value;
    const body = root.querySelector<HTMLTextAreaElement>("[data-live-body]")!.value;
    root.querySelector<HTMLElement>("[data-live-title-count]")!.textContent = `${[...title].length} characters`;
    root.querySelector<HTMLElement>("[data-live-body-count]")!.textContent = `${[...body].length} characters`;
    drafts.set(`${scenario}:${tone}`, { title, body });
  }

  function loadCopy() {
    const chosen = liveAlertScenarios[scenario];
    const copy = drafts.get(`${scenario}:${tone}`) ?? chosen[tone];
    root.querySelector<HTMLInputElement>("[data-live-title]")!.value = copy.title;
    root.querySelector<HTMLTextAreaElement>("[data-live-body]")!.value = copy.body;
    root.querySelector<HTMLElement>("[data-live-copy-context]")!.textContent = `Sample time ${chosen.clock}. ${chosen.context}`;
    root.querySelectorAll<HTMLButtonElement>("[data-live-tone]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.liveTone === tone)));
    updateCounts();
    preview = { ...copy };
    renderNotifications();
  }

  function renderNotifications() {
    const chosen = liveAlertScenarios[scenario];
    const title = escapeLiveText(hideContent ? "Plan Reminder" : preview.title);
    const body = escapeLiveText(hideContent ? "Open ConPaws to view this reminder." : preview.body);
    const output = root.querySelector<HTMLElement>("[data-live-notifications]")!;
    output.classList.toggle("live-large-copy", largeText);
    output.classList.toggle("live-collapsed", collapsed);
    output.innerHTML = `<div class="live-notification-stage"><div class="live-art-label"><span>iOS · ${collapsed ? "Collapsed" : "Expanded"} preview</span><span>${chosen.clock}</span></div><div class="live-ios-alert"><img class="live-app-icon" src="/app-icon.png" alt=""><div><div class="live-alert-app"><strong>ConPaws</strong><span>now</span></div><div class="live-alert-title">${title}</div><div class="live-alert-body">${body}</div></div></div><p class="live-preview-meta">${hideContent ? "Hidden content example; real visibility follows the person's device settings." : "Panel names may appear on the Lock Screen when previews are allowed."}</p></div>
      <div class="live-notification-stage"><div class="live-art-label"><span>Android · ${collapsed ? "Collapsed" : "Expanded"} preview</span><span>${chosen.clock}</span></div><div class="live-alert-android"><div class="live-android-head">${paw}<span>ConPaws · ${chosen.channel} · now</span><span aria-hidden="true" style="margin-left:auto">${collapsed ? "⌄" : "⌃"}</span></div><div class="live-alert-title">${title}</div><div class="live-alert-body">${body}</div>${collapsed || hideContent ? "" : '<div class="live-android-actions"><button type="button" data-live-notification-open>View plan</button></div>'}</div><p class="live-preview-meta">System template, standard priority. Channel and device settings control interruptions.</p></div>`;
  }

  root.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || !root.contains(button)) return;
    const data = button.dataset;
    if (data.liveState && data.liveState in liveActivitySamples) {
      activityState = data.liveState as ActivityState;
      renderActivities();
    } else if (data.liveTone === "short" || data.liveTone === "friendly") {
      tone = data.liveTone;
      loadCopy();
    } else if ("liveStopAndroid" in data) {
      androidStopped = !androidStopped;
      renderActivities();
      root.querySelector<HTMLButtonElement>("[data-live-stop-android]")?.focus({ preventScroll: true });
    } else if ("liveOpenPlan" in data) {
      root.querySelector<HTMLDialogElement>("[data-live-plan-dialog]")!.showModal();
    } else if ("liveNotificationOpen" in data) {
      root.querySelector<HTMLElement>("[data-live-status]")!.textContent = `Preview action: open the ${liveAlertScenarios[scenario].label.toLowerCase()} in your plan. No app navigation or notification was sent.`;
    } else if ("liveCloseDialog" in data) {
      root.querySelector<HTMLDialogElement>("[data-live-plan-dialog]")!.close();
    }
  });
  root.addEventListener("change", event => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input.matches("[data-live-scenario]") && input.value in liveAlertScenarios) {
      scenario = input.value as keyof typeof liveAlertScenarios;
      loadCopy();
    } else if (input.matches("[data-live-hide],[data-live-large],[data-live-collapse]")) {
      hideContent = root.querySelector<HTMLInputElement>("[data-live-hide]")!.checked;
      largeText = root.querySelector<HTMLInputElement>("[data-live-large]")!.checked;
      collapsed = root.querySelector<HTMLInputElement>("[data-live-collapse]")!.checked;
      renderNotifications();
    }
  });
  root.addEventListener("input", event => {
    if ((event.target as HTMLElement).matches("[data-live-title],[data-live-body]")) updateCounts();
  });
  root.querySelector<HTMLFormElement>("[data-live-editor]")!.addEventListener("submit", event => {
    event.preventDefault();
    preview = { title: root.querySelector<HTMLInputElement>("[data-live-title]")!.value, body: root.querySelector<HTMLTextAreaElement>("[data-live-body]")!.value };
    renderNotifications();
    root.querySelector<HTMLElement>("[data-live-status]")!.textContent = "Preview updated on both platforms. Nothing sent to a device.";
  });
  renderActivities();
  loadCopy();
}
