import type { ScheduleViewSwitcherProps } from "./ScheduleViewSwitcher.types";
import { ScheduleViewSwitcherStacked } from "./ScheduleViewSwitcherStacked";

/**
 * Platforms without a native segmented control (web, tests) get the stacked
 * rows. iOS and Android resolve their own `.ios.tsx` / `.android.tsx` files,
 * which only fall back to the stacked form at the accessibility text sizes.
 */
export function ScheduleViewSwitcher(props: ScheduleViewSwitcherProps) {
  return <ScheduleViewSwitcherStacked {...props} />;
}
