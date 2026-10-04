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
      help: "A ready-to-use schedule, saved on your phone.",
      state: "124 sample events · Ready to download",
      button: "Choose this convention",
      status: "No account needed for your local plan.",
    },
    {
      title: "Check your convention",
      help: "Confirm the dates and convention time zone before downloading.",
      state: "124 sample events · Ready to download",
      button: "Download sample schedule",
      status: "Real downloads need progress, failure, and retry states.",
    },
    {
      title: "Your con is ready",
      help: "Next: open the schedule and save your first panel.",
      state: "Saved on this preview · 124 sample events",
      button: "Save a sample event",
      status:
        "Demo only: no SQLite download occurred. Real cached plans must work in airplane mode.",
    },
    {
      title: "Your first event is saved",
      help: "You're ready to plan your day. Reminders are optional.",
      state: "Character design lab · Oak · 2:45 PM",
      button: "Setup demo complete",
      status:
        "Next in the real app: choose a reminder and explain notification permission when needed.",
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
      text("[data-admin-state]", "Sample revision 8 published");
      text(
        "[data-admin-status]",
        "Preview complete. No real convention, feed, or published data was changed.",
      );
    }
    if (button.hasAttribute("data-admin-reset")) {
      published = false;
      reviewed.checked = false;
      reviewed.disabled = false;
      publish.disabled = true;
      text("[data-admin-state]", "Draft revision 8");
      text(
        "[data-admin-status]",
        "Publishing is blocked until the review is confirmed.",
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
      copy: "Saved plan copied at 2:16 PM",
      watchCopy: "Saved copy · 2:16 PM",
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
      copy: "Saved plan copied at 2:16 PM",
      watchCopy: "Saved copy · 2:16 PM",
      heading: "The last panel is still a panel.",
      explanation:
        "The current Swift widget paths require a future event. That drops a valid ongoing final panel into an empty state. Add a current-only state and move to finished only after the known end.",
    },
    stale: {
      label: "SAVED PLAN · UP NEXT 2:45 PM",
      title: "Character design lab",
      room: "Oak · Saved room",
      detail: "Open ConPaws to check for changes",
      watchDetail: "Older saved copy",
      copy: "Plan last copied 2 hours ago",
      watchCopy: "Last copied 2 hours ago",
      heading: "Show what freshness actually means.",
      explanation:
        "An old phone-to-Watch copy is not proof that the organizer's feed is old. Keep the last good plan useful and show copy age. The real refresh threshold is a product decision to test; this two-hour state is illustrative.",
    },
    empty: {
      label: "YOUR PLAN · TODAY",
      title: "No saved events today",
      room: "Browse the schedule",
      detail: "Save a panel in ConPaws on your phone",
      watchDetail: "Add events on your phone",
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
