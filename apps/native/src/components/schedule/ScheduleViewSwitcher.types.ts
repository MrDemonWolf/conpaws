export type ScheduleView = "all" | "mine" | "now";

export const SCHEDULE_VIEWS: readonly ScheduleView[] = ["all", "mine", "now"];

export interface ScheduleViewSwitcherProps {
  view: ScheduleView;
  onChange: (view: ScheduleView) => void;
  labels: Record<ScheduleView, string>;
  /** Spoken name of the whole control. */
  accessibilityLabel: string;
}
