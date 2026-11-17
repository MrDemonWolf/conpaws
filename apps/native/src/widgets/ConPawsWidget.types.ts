import type { WidgetSnapshot } from "@/services/widget-snapshot";

export interface ConPawsWidgetProps {
  snapshot: WidgetSnapshot;
  expired?: boolean;
}

export interface ConPawsWidgetConfiguration {
  convention?: string | null;
  mode: "automatic" | "countdown" | "nextEvent";
}

export type WidgetPluralUnit = Record<
  "one" | "few" | "other" | "obliqueOne" | "obliqueFew" | "obliqueOther",
  string
>;

/** Selected fields from the canonical Codable ConPawsStrings table. */
export type WidgetStrings = Record<
  | "language"
  | "now"
  | "startingSoon"
  | "today"
  | "tomorrow"
  | "inFormat"
  | "compactNow"
  | "compactSoon"
  | "compactHoursFormat"
  | "compactDaysFormat"
  | "compactMonthsFormat"
  | "compactMinutesFormat"
  | "comingUpCaps"
  | "upNextCaps"
  | "happeningNowCaps"
  | "startsIn"
  | "startsInCaps"
  | "untilCapsFormat"
  | "reminderAtFormat"
  | "minutesBeforeFormat"
  | "noLaterSavedEvents"
  | "noLaterSavedEventsShort"
  | "noPicksTitle"
  | "noPicksHint"
  | "noConventionTitle"
  | "noConventionHint"
  | "finishedTitle"
  | "finishedHint"
  | "nextEventA11yFormat"
  | "planLastUpdatedFormat"
  | "staleHint"
  | "moreTodayFormat",
  string
> & {
  hoursUnit: WidgetPluralUnit;
  daysUnit: WidgetPluralUnit;
  monthsUnit: WidgetPluralUnit;
  minutesUnit: WidgetPluralUnit;
};
