export interface QuickActionLabels {
  schedule: string;
  find: string;
  create: string;
  import: string;
}

type LabelKey =
  | "schedule.title"
  | "home.find"
  | "convention.create"
  | "convention.importSchedule";

/** Launcher labels use the app's language, including its regional variants. */
export function buildQuickActionLabels(
  translate: (key: LabelKey) => string,
): QuickActionLabels {
  return {
    schedule: translate("schedule.title"),
    find: translate("home.find"),
    create: translate("convention.create"),
    import: translate("convention.importSchedule"),
  };
}
