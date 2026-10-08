import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useWindowDimensions, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";
import {
  SCHEDULE_VIEWS,
  type ScheduleViewSwitcherProps,
} from "./ScheduleViewSwitcher.types";
import { ScheduleViewSwitcherStacked } from "./ScheduleViewSwitcherStacked";

/** Material's segmented buttons also run out of room at large font scales. */
const STACK_AT_FONT_SCALE = 1.6;

/**
 * The Browse / My plan / Now switcher as Material 3 segmented buttons, which
 * is the component Material names for choosing one of two to five views.
 *
 * The Host gets an explicit minimum height: a `matchContents` Host measured
 * at zero height on Android once before (see `ui/EmptyState.tsx`).
 */
export function ScheduleViewSwitcher(props: ScheduleViewSwitcherProps) {
  const { fontScale } = useWindowDimensions();
  const resolvedColorScheme = useResolvedColorScheme();
  if (fontScale >= STACK_AT_FONT_SCALE) {
    return <ScheduleViewSwitcherStacked {...props} />;
  }

  const { view, onChange, labels } = props;
  return (
    <View className="px-4" accessibilityLabel={props.accessibilityLabel}>
      <Host
        colorScheme={resolvedColorScheme}
        seedColor={themeTokens[resolvedColorScheme].primary}
        matchContents={{ vertical: true }}
        style={{ alignSelf: "stretch", minHeight: 48 }}
      >
        <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
          {SCHEDULE_VIEWS.map((candidate) => (
            <SegmentedButton
              key={candidate}
              selected={candidate === view}
              onClick={() => onChange(candidate)}
            >
              <SegmentedButton.Label>
                <Text>{labels[candidate]}</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </Host>
    </View>
  );
}
