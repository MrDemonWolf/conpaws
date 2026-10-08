import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ConventionEventRow } from "@/components/convention-detail/ConventionEventRow";
import { SwipeToggleRow } from "@/components/convention-detail/SwipeToggleRow";
import type { ConventionEvent } from "@/db/schema";
import type { ClusterPosition } from "@/lib/day-band";
import { eventSwipeSides } from "@/lib/event-swipe";

interface SwipeableEventRowProps {
  event: ConventionEvent;
  timeZone: string;
  locale: string;
  hour12?: boolean;
  showProvenance: boolean;
  hasConflict: boolean;
  /** Overlap grouping from `overlapInfo`, forwarded to the row chrome. */
  overlapPosition?: ClusterPosition;
  overlapGroupSize?: number;
  overlapCount?: number;
  accentColor?: string | null;
  /** The visible star button; omitted on lists where every row is saved. */
  trailingAction?: {
    label: string;
    selected: boolean;
    onPress: () => void;
    testID?: string;
  };
  savedLabel?: string;
  onSelect: (event: ConventionEvent) => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  className?: string;
}

/**
 * Swipe shortcut over the plain event row: leading swipe adds an unstarred
 * event to the plan, trailing swipe removes a starred one. Haptics and the
 * VoiceOver announcement fire from the toggle mutation's onSuccess, exactly
 * as they do for the sheet path -- firing here too would double them.
 */
export const SwipeableEventRow = memo(function SwipeableEventRow({
  event,
  onToggleSchedule,
  ...rowProps
}: SwipeableEventRowProps) {
  const { t } = useTranslation();
  const sides = eventSwipeSides(event.isInSchedule);

  return (
    <SwipeToggleRow
      addLabel={sides.leading ? t("common.add") : undefined}
      removeLabel={sides.trailing ? t("common.remove") : undefined}
      onToggle={() => onToggleSchedule(event)}
    >
      <ConventionEventRow event={event} {...rowProps} />
    </SwipeToggleRow>
  );
});
