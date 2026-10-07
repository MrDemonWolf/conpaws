// Fictional preview state only. No network, backend writes, or attendee data.
export function mountReview(root: HTMLElement) {
  const query = <T extends HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing review element: ${selector}`);
    return element;
  };
  const text = (selector: string, value: string) => {
    query(selector).textContent = value;
  };
  let setupStep = 0;
  const setup = [
    {
      title: "Find your convention",
      help: "Choose the convention you’re attending.",
      state: "124 sample panels · Ready to download",
      button: "Choose this convention",
      status: "No account needed. Your plan stays on your phone.",
    },
    {
      title: "Check the dates",
      help: "Make sure the dates match, then download the schedule.",
      state: "124 sample panels · Ready to download",
      button: "Download sample schedule",
      status:
        "Show download progress. If it stops, explain what happened and offer Try Again.",
    },
    {
      title: "Your schedule is ready",
      help: "Open the schedule and choose your first panel.",
      state: "Saved in this demo · 124 sample panels",
      button: "Save a sample panel",
      status:
        "This is only a demo. No schedule was downloaded to your phone. A saved schedule should still open without an internet connection.",
    },
    {
      title: "Your first panel is saved",
      help: "You're ready to plan your day. Reminders are optional.",
      state: "Character design lab · Oak · 2:45 PM",
      button: "You’re all set",
      status:
        "Next: ask if you’d like reminders, and explain how to turn them on.",
    },
  ];
  function renderSetup() {
    const current = setup[setupStep];
    if (!current) return;
    text("[data-setup-progress]", `Step ${setupStep + 1} of ${setup.length}`);
    query<HTMLProgressElement>("[data-setup-meter]").value = setupStep + 1;
    text("[data-setup-title]", current.title);
    text("[data-setup-help]", current.help);
    text("[data-setup-state]", current.state);
    text("[data-setup-next]", current.button);
    text("[data-setup-status]", current.status);
    query<HTMLButtonElement>("[data-setup-next]").disabled = setupStep === 3;
  }
  const reviewed = query<HTMLInputElement>("[data-admin-reviewed]");
  const publish = query<HTMLButtonElement>("[data-admin-publish]");
  let published = false;
  reviewed.addEventListener("change", () => {
    publish.disabled = !reviewed.checked || published;
  });
  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("button");
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute("data-setup-next") && setupStep < 3) {
      setupStep += 1;
      renderSetup();
    }
    if (button.hasAttribute("data-setup-reset")) {
      setupStep = 0;
      renderSetup();
    }
    if (
      button.hasAttribute("data-admin-publish") &&
      reviewed.checked &&
      !published
    ) {
      published = true;
      publish.disabled = true;
      reviewed.disabled = true;
      text("[data-admin-state]", "Sample schedule published");
      text(
        "[data-admin-status]",
        "Demo complete. No real convention or schedule was changed.",
      );
    }
    if (button.hasAttribute("data-admin-reset")) {
      published = false;
      reviewed.checked = false;
      reviewed.disabled = false;
      publish.disabled = true;
      text("[data-admin-state]", "Sample schedule draft");
      text(
        "[data-admin-status]",
        "Check the sample schedule before publishing it.",
      );
    }
  });
  const glance = {
    next: {
      label: "UP NEXT · 2:45 PM",
      title: "Character design lab",
      room: "Oak",
      detail: "Reminder at 2:35 · 10 min before",
      watchDetail: "Reminder at 2:35",
      copy: "Plan last updated here · 2:16 PM",
      watchCopy: "Last updated · 2:16 PM",
      heading: "Make the room easy to find.",
      explanation:
        "Title, room, and start time carry the decision. A reminder offset is not a calculated walking time. On the real Watch, tap for the current event and today's plan.",
    },
    last: {
      label: "HAPPENING NOW · UNTIL 4 PM",
      title: "Closing circle",
      room: "Ballroom A",
      detail: "No later events in your saved plan",
      watchDetail: "No later saved events",
      copy: "Plan last updated here · 2:16 PM",
      watchCopy: "Last updated · 2:16 PM",
      heading: "The last panel is still a panel.",
      explanation:
        "The current Swift widget paths require a future event. That drops a valid ongoing final panel into an empty state. Add a current-only state and move to finished only after the known end.",
    },
    stale: {
      label: "SAVED PLAN · UP NEXT 2:45 PM",
      title: "Character design lab",
      room: "Oak · Saved room",
      detail: "Open ConPaws to check for changes",
      watchDetail: "This plan may be out of date",
      copy: "Plan last updated here · 2 hours ago",
      watchCopy: "Last updated · 2 hours ago",
      heading: "Show what freshness actually means.",
      explanation:
        "An old phone-to-Watch copy is not proof that the organizer's feed is old. Keep the last good plan useful and show copy age. The real refresh threshold is a product decision to test; this two-hour state is illustrative.",
    },
    empty: {
      label: "YOUR PLAN · TODAY",
      title: "No panels picked today",
      room: "Browse the schedule",
      detail: "Choose a panel in ConPaws on your phone",
      watchDetail: "Choose panels on your iPhone",
      copy: "This does not mean the convention has no events",
      watchCopy: "Saved plan only",
      heading: "Empty is a reason, not a dead end.",
      explanation:
        "Distinguish no saved events, no published schedule, finished day, sync failure, and unknown end times. Do not promise another saved event tomorrow unless one actually exists.",
    },
  };
  const select = query<HTMLSelectElement>("[data-glance-state]");
  select.addEventListener("change", () => {
    if (!(select.value in glance)) return;
    const current = glance[select.value as keyof typeof glance];
    for (const surface of ["widget", "watch"]) {
      text(`[data-glance-${surface}-label]`, current.label);
      text(`[data-glance-${surface}-title]`, current.title);
      text(`[data-glance-${surface}-room]`, current.room);
      text(
        `[data-glance-${surface}-detail]`,
        surface === "watch" ? current.watchDetail : current.detail,
      );
      text(
        `[data-glance-${surface}-copy]`,
        surface === "watch" ? current.watchCopy : current.copy,
      );
    }
    text("[data-glance-explanation-title]", current.heading);
    text("[data-glance-explanation]", current.explanation);
    text("[data-glance-clock]", select.value === "last" ? "3:18" : "2:18");
  });
}
