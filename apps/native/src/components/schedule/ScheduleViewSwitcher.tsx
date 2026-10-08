import { Pressable, View } from "react-native";
import { PRESS_DIM, Text } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_VIEWS,
  type ScheduleViewSwitcherProps,
} from "./ScheduleViewSwitcher.types";

/**
 * The fallback switcher: three stacked rows acting as tabs.
 *
 * It is the whole control on platforms without a native segmented control
 * (web, tests), and the large-text form on iOS and Android, where a native
 * segmented control truncates three labels to a few letters each at the
 * accessibility sizes. The `.ios.tsx` and `.android.tsx` siblings render the
 * platform control at ordinary sizes and import this for the large ones.
 */
export function ScheduleViewSwitcherStacked({
  view,
  onChange,
  labels,
  accessibilityLabel,
}: ScheduleViewSwitcherProps) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="mx-4 overflow-hidden rounded-xl border border-border"
      style={{ borderCurve: "continuous" }}
    >
      {SCHEDULE_VIEWS.map((candidate, index) => {
        const selected = candidate === view;
        return (
          <Pressable
            key={candidate}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(candidate)}
            className={cn(
              "min-h-12 justify-center px-4",
              index > 0 && "border-border border-t",
              selected ? "bg-primary" : "bg-card",
              PRESS_DIM,
            )}
          >
            <Text
              variant="label"
              className={cn(
                "text-center",
                selected ? "text-primary-foreground" : "text-foreground",
              )}
            >
              {labels[candidate]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ScheduleViewSwitcher(props: ScheduleViewSwitcherProps) {
  return <ScheduleViewSwitcherStacked {...props} />;
}
