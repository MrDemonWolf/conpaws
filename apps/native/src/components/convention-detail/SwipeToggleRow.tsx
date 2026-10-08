import type { ReactNode } from "react";
import { useRef } from "react";
import { View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Text } from "@/components/ui";

function ActionPill({
  label,
  variant,
}: {
  label: string;
  variant: "add" | "remove";
}) {
  return (
    <View
      className={`justify-center px-5 ${
        variant === "add" ? "bg-primary" : "bg-destructive"
      }`}
    >
      <Text
        variant="body"
        className={
          variant === "add"
            ? "text-primary-foreground font-semibold"
            : "text-destructive-foreground font-semibold"
        }
      >
        {label}
      </Text>
    </View>
  );
}

interface SwipeToggleRowProps {
  /** Label of the leading (add) pill, or undefined for no leading swipe. */
  addLabel?: string;
  /** Label of the trailing (remove) pill, or undefined for no trailing swipe. */
  removeLabel?: string;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * The swipe accelerator shared by the schedule rows: leading swipe adds,
 * trailing swipe removes, and the side that does not apply never engages.
 * The row's tap remains the full-featured, screen-reader-reachable path, so
 * the swipe carries no accessibility actions of its own.
 */
export function SwipeToggleRow({
  addLabel,
  removeLabel,
  onToggle,
  children,
}: SwipeToggleRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={48}
      rightThreshold={48}
      // Require a clearly horizontal drag before engaging, so a vertical list
      // scroll never half-opens a row.
      dragOffsetFromLeftEdge={16}
      dragOffsetFromRightEdge={16}
      renderLeftActions={
        addLabel
          ? () => <ActionPill label={addLabel} variant="add" />
          : undefined
      }
      renderRightActions={
        removeLabel
          ? () => <ActionPill label={removeLabel} variant="remove" />
          : undefined
      }
      onSwipeableWillOpen={() => {
        swipeable.current?.close();
        onToggle();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
