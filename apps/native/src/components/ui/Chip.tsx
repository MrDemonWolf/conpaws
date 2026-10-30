import { Pressable } from "react-native";
import { cn } from "@/lib/utils";
import { PRESS_DIM, TAP_TARGET } from "./Row";
import { Text } from "./Text";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A selectable pill for a horizontal filter strip: the hour chips and the
 * "All times" chip on the Browse view.
 *
 * Selection is written into `accessibilityState`, not only into colour, so a
 * screen reader hears "selected" and a colour-blind reader still gets the
 * filled-versus-outlined shape. `TAP_TARGET` keeps the 48 dp Material floor,
 * which also satisfies the 44 pt iOS one.
 */
export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  testID,
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      className={cn(
        TAP_TARGET,
        "justify-center rounded-full px-4",
        selected ? "bg-primary" : "border border-border bg-card",
        PRESS_DIM,
      )}
      style={{ borderCurve: "continuous" }}
    >
      <Text
        variant="label"
        numberOfLines={1}
        className={selected ? "text-primary-foreground" : "text-foreground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
