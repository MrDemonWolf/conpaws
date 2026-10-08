import { Host, Picker, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { useWindowDimensions, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";
import { ScheduleViewSwitcherStacked } from "./ScheduleViewSwitcher";
import {
  SCHEDULE_VIEWS,
  type ScheduleView,
  type ScheduleViewSwitcherProps,
} from "./ScheduleViewSwitcher.types";

/** Past this scale UISegmentedControl shows a few letters per segment. */
const STACK_AT_FONT_SCALE = 1.6;

/**
 * The Browse / My plan / Now switcher as a real UISegmentedControl, through
 * SwiftUI's segmented `Picker`. The system owns its look, its selection
 * animation, VoiceOver's "adjustable" behaviour and the tint.
 */
export function ScheduleViewSwitcher(props: ScheduleViewSwitcherProps) {
  const { fontScale } = useWindowDimensions();
  const resolvedColorScheme = useResolvedColorScheme();
  if (fontScale >= STACK_AT_FONT_SCALE) {
    return <ScheduleViewSwitcherStacked {...props} />;
  }

  const { view, onChange, labels, accessibilityLabel } = props;
  return (
    <View className="px-4">
      <Host
        colorScheme={resolvedColorScheme}
        seedColor={themeTokens[resolvedColorScheme].primary}
        matchContents={{ vertical: true }}
        style={{ alignSelf: "stretch" }}
      >
        <Picker<ScheduleView>
          selection={view}
          onSelectionChange={(selection) => {
            if (SCHEDULE_VIEWS.includes(selection)) onChange(selection);
          }}
          modifiers={[
            pickerStyle("segmented"),
            accessibilityLabelModifier(accessibilityLabel),
          ]}
        >
          {SCHEDULE_VIEWS.map((candidate) => (
            <Text key={candidate} modifiers={[tag(candidate)]}>
              {labels[candidate]}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}
