import type { IconName } from "@expo/ui";
import { memo, type ReactNode } from "react";
import { View } from "react-native";
import { BrowseSummaryHeader } from "@/components/schedule/BrowseSummaryHeader";
import { DayStrip, type DayStripDay } from "@/components/schedule/DayStrip";
import {
  NowHeroCard,
  type NowHeroCardProps,
} from "@/components/schedule/NowHeroCard";
import { ScheduleViewSwitcher } from "@/components/schedule/ScheduleViewSwitcher";
import type { ScheduleView } from "@/components/schedule/ScheduleViewSwitcher.types";
import {
  TimeChipRow,
  type TimeChipSlot,
} from "@/components/schedule/TimeChipRow";
import { EmptyState, Text } from "@/components/ui";

export interface ConventionScheduleHeaderProps {
  view: ScheduleView;
  onChangeView: (view: ScheduleView) => void;
  viewLabels: Record<ScheduleView, string>;
  viewAccessibilityLabel: string;
  /** The caption, banners and hint card the screen already owns. */
  notices: ReactNode;
  dayStrip: {
    monthLabel: string;
    days: readonly DayStripDay[];
    selectedKey: string;
    allKey: string;
    allLabel: string;
    allCount: number;
    allAccessibilityLabel: string;
    onSelect: (key: string) => void;
  } | null;
  timeChips: {
    slots: readonly TimeChipSlot[];
    selectedStartMs: number | null;
    allTimesLabel: string;
    onSelect: (startMs: number | null) => void;
  } | null;
  summary: {
    heading: string;
    countLabel: string;
    totalLabel?: string;
    hint: { text: string; actionLabel?: string; onAction?: () => void };
  } | null;
  hero: NowHeroCardProps | null;
  /** A compact message above the list for the Now view's non-hero states. */
  nowNotice: {
    icon?: IconName;
    title: string;
    subtitle?: string;
    ctaLabel?: string;
    onCta?: () => void;
  } | null;
  /** "Also saved right now" caption between the hero and its list. */
  alsoNowLabel?: string;
}

/**
 * Everything above the rows of the convention schedule, as one memoised
 * component so a search keystroke or a tick of the clock re-renders only the
 * parts whose props changed. Rendered through `ListHeaderComponent` as an
 * element, which keeps the native segmented control mounted across renders.
 */
export const ConventionScheduleHeader = memo(function ConventionScheduleHeader({
  view,
  onChangeView,
  viewLabels,
  viewAccessibilityLabel,
  notices,
  dayStrip,
  timeChips,
  summary,
  hero,
  nowNotice,
  alsoNowLabel,
}: ConventionScheduleHeaderProps) {
  return (
    <View className="gap-3 pt-2 pb-1">
      <ScheduleViewSwitcher
        view={view}
        onChange={onChangeView}
        labels={viewLabels}
        accessibilityLabel={viewAccessibilityLabel}
      />
      {notices}
      {dayStrip ? <DayStrip {...dayStrip} /> : null}
      {timeChips ? <TimeChipRow {...timeChips} /> : null}
      {summary ? <BrowseSummaryHeader {...summary} /> : null}
      {hero ? <NowHeroCard {...hero} /> : null}
      {nowNotice ? (
        <EmptyState
          compact
          icon={nowNotice.icon}
          title={nowNotice.title}
          subtitle={nowNotice.subtitle}
          ctaLabel={nowNotice.ctaLabel}
          onCta={nowNotice.onCta}
          className="rounded-2xl bg-card"
        />
      ) : null}
      {alsoNowLabel ? (
        <Text variant="caption" className="px-4 pt-1 font-semibold">
          {alsoNowLabel}
        </Text>
      ) : null}
    </View>
  );
});
