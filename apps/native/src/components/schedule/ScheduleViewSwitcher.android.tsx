import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useWindowDimensions } from "react-native";
import { ReadableColumn } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { SEGMENTED_MAX } from "@/lib/content-width";
import { STACKED_FONT_SCALE } from "@/lib/text-scale";
import { themeTokens } from "@/lib/theme-tokens";
import {
  SCHEDULE_VIEWS,
  type ScheduleViewSwitcherProps,
} from "./ScheduleViewSwitcher.types";
import { ScheduleViewSwitcherStacked } from "./ScheduleViewSwitcherStacked";

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
  // Material's segmented buttons also run out of room at large font scales.
  if (fontScale >= STACKED_FONT_SCALE) {
    return <ScheduleViewSwitcherStacked {...props} />;
  }

  const { view, onChange, labels } = props;
  // Three short labels stretched across a wide window read as one bar.
  return (
    <ReadableColumn
      max={SEGMENTED_MAX}
      className="px-4"
      accessibilityLabel={props.accessibilityLabel}
    >
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
    </ReadableColumn>
  );
}
