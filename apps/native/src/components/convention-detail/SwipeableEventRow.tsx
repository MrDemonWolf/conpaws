import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { ConventionEventRow } from "@/components/convention-detail/ConventionEventRow";
import { Text } from "@/components/ui";
import type { ConventionEvent } from "@/db/schema";
import { eventSwipeSides } from "@/lib/event-swipe";

interface SwipeableEventRowProps {
  event: ConventionEvent;
  timeZone: string;
  locale: string;
  hour12?: boolean;
  showProvenance: boolean;
  hasConflict: boolean;
  onSelect: (event: ConventionEvent) => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  /** Day-band background, forwarded to the row. */
  className?: string;
}

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

/**
 * Swipe shortcut over the plain event row: leading swipe adds an unstarred
 * event to My Schedule, trailing swipe removes a starred one, and the side
 * that does not apply never engages (see `eventSwipeSides`). The row's tap →
 * sheet remains the full-featured, screen-reader-reachable path — the swipe is
 * an accelerator, so it carries no accessibility actions of its own.
 *
 * Haptics and the VoiceOver announcement fire from the toggle mutation's
 * onSuccess, exactly as they do for the sheet path — firing here too would
 * double them.
 */
export const SwipeableEventRow = memo(function SwipeableEventRow({
  event,
  onToggleSchedule,
  ...rowProps
}: SwipeableEventRowProps) {
  const { t } = useTranslation();
  const swipeable = useRef<SwipeableMethods>(null);
  const sides = eventSwipeSides(event.isInSchedule);

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={48}
      rightThreshold={48}
      // Require a clearly horizontal drag before engaging, so a vertical list
      // scroll never half-opens a row. (Swipeable's own drag-offset knob; the
      // Pan-gesture activeOffsetX prop does not exist on this component.)
      dragOffsetFromLeftEdge={16}
      dragOffsetFromRightEdge={16}
      renderLeftActions={
        sides.leading
          ? () => <ActionPill label={t("common.add")} variant="add" />
          : undefined
      }
      renderRightActions={
        sides.trailing
          ? () => <ActionPill label={t("common.remove")} variant="remove" />
          : undefined
      }
      onSwipeableWillOpen={() => {
        swipeable.current?.close();
        onToggleSchedule(event);
      }}
    >
      <ConventionEventRow event={event} {...rowProps} />
    </ReanimatedSwipeable>
  );
});
