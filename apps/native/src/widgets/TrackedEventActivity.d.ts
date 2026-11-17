import type {
  LiveActivityEnvironment,
  LiveActivityFactory,
  LiveActivityLayout,
} from "expo-widgets";
import type { TrackedEventProps } from "@/lib/tracked-event.types";

export function TrackedEventActivityLayout(
  props: TrackedEventProps,
  environment: LiveActivityEnvironment,
): LiveActivityLayout;

declare const TrackedEventActivity: LiveActivityFactory<TrackedEventProps>;
export default TrackedEventActivity;
