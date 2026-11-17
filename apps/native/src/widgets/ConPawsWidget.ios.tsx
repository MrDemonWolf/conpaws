import {
  AccessoryWidgetBackground,
  Divider,
  Gauge,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  accessibilityHint,
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  gaugeStyle,
  layoutPriority,
  lineLimit,
  monospacedDigit,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { WidgetEventSnapshot } from "@/services/widget-snapshot";
import type {
  ConPawsWidgetConfiguration,
  ConPawsWidgetProps,
  WidgetPluralUnit,
} from "./ConPawsWidget.types";

export function ConPawsWidgetLayout(
  { snapshot, expired }: ConPawsWidgetProps,
  environment: WidgetEnvironment<ConPawsWidgetConfiguration>,
) {
  "widget";

  const invalid =
    ![1, 2].includes(snapshot.schemaVersion) ||
    !Array.isArray(snapshot.conventions);
  const conventions = invalid ? [] : snapshot.conventions;
  const now = environment.date?.getTime() ?? snapshot.generatedAtMs;
  const family = environment.widgetFamily ?? "systemSmall";
  const accessory = family.startsWith("accessory");
  const dark = environment.colorScheme === "dark";
  const monochrome =
    environment.widgetRenderingMode === "vibrant" ||
    environment.widgetRenderingMode === "accented";
  const accent = monochrome
    ? dark
      ? "#FFFFFF"
      : "#000000"
    : dark
      ? "#18B7F2"
      : "#00618A";
  const primary = foregroundStyle({ type: "hierarchical", style: "primary" });
  const secondary = foregroundStyle({
    type: "hierarchical",
    style: "secondary",
  });
  const caption = font({ textStyle: "caption2" });
  const title = font({ textStyle: "footnote", weight: "semibold" });
  const strings = snapshot.presentation?.strings;
  const fallback = {
    now: "Now",
    startingSoon: "Starting soon",
    today: "Today",
    tomorrow: "Tomorrow",
    comingUpCaps: "COMING UP",
    upNextCaps: "UP NEXT",
    happeningNowCaps: "HAPPENING NOW",
    startsIn: "Starts in",
    startsInCaps: "STARTS IN",
    noConventionTitle: "No convention yet",
    noConventionHint: "Add a convention in ConPaws.",
    noPicksTitle: "No panels picked",
    noPicksHint: "Choose a panel in ConPaws on your phone",
    finishedTitle: "Your plan is finished",
    finishedHint: "Open ConPaws to browse your schedule.",
    noLaterSavedEvents: "No later events in your saved plan",
    noLaterSavedEventsShort: "No later saved events",
    untilCapsFormat: "UNTIL %@",
    nextEventA11yFormat: "Next event: %1$@, starts %2$@",
    inFormat: "In %@",
    compactNow: "Now",
    compactSoon: "Soon",
    compactHoursFormat: "%@h",
    compactDaysFormat: "%@d",
    compactMonthsFormat: "%@mo",
    compactMinutesFormat: "%@ min",
    reminderAtFormat: "Reminder at %1$@ · %2$@",
    minutesBeforeFormat: "%@ before",
    planLastUpdatedFormat: "Plan last updated here · %@",
    staleHint: "Open ConPaws to update your plan.",
    moreTodayFormat: "+%@ more today",
  };
  function word(key: keyof typeof fallback): string {
    return strings?.[key] ?? fallback[key];
  }
  function format(template: string, ...values: string[]): string {
    let index = 0;
    return template.replace(
      /%(?:(\d+)\$)?@/g,
      (_match, position: string | undefined) =>
        values[position ? Number(position) - 1 : index++] ?? "",
    );
  }
  function unit(
    kind: "hours" | "days" | "months" | "minutes",
    count: number,
    oblique = false,
  ): string {
    const language = strings?.language ?? "en";
    const value = Math.abs(count);
    const mod10 = value % 10;
    const mod100 = value % 100;
    const one =
      language === "ru" || language === "uk"
        ? mod10 === 1 && mod100 !== 11
        : value === 1;
    const few =
      language === "cs"
        ? value >= 2 && value <= 4
        : ["pl", "ru", "uk"].includes(language) &&
          mod10 >= 2 &&
          mod10 <= 4 &&
          !(mod100 >= 12 && mod100 <= 14);
    const form = one ? "One" : few ? "Few" : "Other";
    const table: WidgetPluralUnit | undefined = strings?.[`${kind}Unit`];
    const key = oblique ? `oblique${form}` : form.toLowerCase();
    const template =
      table?.[key as keyof WidgetPluralUnit] ??
      `%@ ${kind === "hours" ? (one ? "hour" : "hours") : kind === "days" ? (one ? "day" : "days") : kind === "months" ? (one ? "month" : "months") : one ? "minute" : "minutes"}`;
    return format(template, String(count));
  }
  function calendarParts(timestamp: number, timeZone: string): number[] {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date(timestamp));
    return ["year", "month", "day"].map((type) =>
      Number(parts.find((part) => part.type === type)?.value),
    );
  }
  function dayNumber(timestamp: number, timeZone: string): number {
    const [year, month, day] = calendarParts(timestamp, timeZone);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  }
  function countdown(
    timestamp: number,
    timeZone: string,
    compact = false,
  ): string {
    const remaining = timestamp - now;
    if (remaining <= 0) return word(compact ? "compactNow" : "now");
    if (remaining < 3_600_000)
      return word(compact ? "compactSoon" : "startingSoon");
    if (remaining < 86_400_000) {
      const hours = Math.floor(remaining / 3_600_000);
      return compact
        ? format(word("compactHoursFormat"), String(hours))
        : format(word("inFormat"), unit("hours", hours, true));
    }
    const days = dayNumber(timestamp, timeZone) - dayNumber(now, timeZone);
    if (days <= 1)
      return compact
        ? format(word("compactDaysFormat"), String(Math.max(0, days)))
        : word(days <= 0 ? "today" : "tomorrow");
    const [year, month, day] = calendarParts(timestamp, timeZone);
    const [fromYear, fromMonth, fromDay] = calendarParts(now, timeZone);
    const months =
      (year - fromYear) * 12 + month - fromMonth - (day < fromDay ? 1 : 0);
    if (days >= 30 && months >= 1)
      return compact
        ? format(word("compactMonthsFormat"), String(months))
        : format(word("inFormat"), unit("months", months, true));
    return compact
      ? format(word("compactDaysFormat"), String(days))
      : format(word("inFormat"), unit("days", days, true));
  }
  function end(event: WidgetEventSnapshot): number {
    return event.endAtMs ?? event.startAtMs + 3_600_000;
  }
  function place(event: WidgetEventSnapshot): string {
    return [
      ...new Set(
        [event.room, event.location]
          .map((value) => value?.trim())
          .filter(Boolean),
      ),
    ].join(" • ");
  }
  const configuration = environment.configuration;
  const candidates = conventions.filter(
    (convention) =>
      convention.endAtMs >= now ||
      convention.events.some((event) => event.startAtMs >= now),
  );
  const underway = candidates.filter(
    (convention) => convention.startAtMs <= now && convention.events.length > 0,
  );
  const convention =
    configuration?.convention && configuration.convention !== "current"
      ? conventions.find((item) => item.id === configuration.convention)
      : ((underway.length > 0 ? underway : candidates)
          .slice()
          .sort((a, b) => a.startAtMs - b.startAtMs)[0] ??
        conventions.slice().sort((a, b) => b.endAtMs - a.endAtMs)[0]);
  const zone = convention?.timeZoneIdentifier ?? "UTC";
  const locale = snapshot.localeIdentifier || "en";
  const hour12 =
    snapshot.timeFormat === "12"
      ? true
      : snapshot.timeFormat === "24"
        ? false
        : snapshot.presentation?.hour12;
  function clock(timestamp: number, includeDay = false): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12,
    };
    if (includeDay && dayNumber(timestamp, zone) !== dayNumber(now, zone))
      options.weekday = "short";
    return new Intl.DateTimeFormat(locale, options).format(new Date(timestamp));
  }
  const events = (convention?.events ?? [])
    .slice()
    .sort((a, b) => a.startAtMs - b.startAtMs || a.id.localeCompare(b.id));
  const current = events
    .filter((event) => event.startAtMs <= now && end(event) > now)
    .at(-1);
  const future = events.filter((event) => event.startAtMs > now);
  const next = future[0];
  const beforeConvention =
    convention &&
    convention.startAtMs > now &&
    configuration?.mode !== "nextEvent";
  const reminderWindow =
    next &&
    next.reminderMinutes !== null &&
    next.reminderMinutes > 0 &&
    now >= next.startAtMs - next.reminderMinutes * 60_000;
  const status = beforeConvention
    ? "countdown"
    : next
      ? reminderWindow
        ? "reminder"
        : "next"
      : current
        ? "current"
        : convention
          ? events.length > 0
            ? "finished"
            : "noPicks"
          : "empty";
  const scheme = snapshot.presentation?.appScheme;
  const link = scheme
    ? convention
      ? `${scheme}://convention/${encodeURIComponent(convention.id)}`
      : `${scheme}://`
    : undefined;
  const stale =
    snapshot.generatedAtMs > 0 && now - snapshot.generatedAtMs >= 30 * 60_000;
  const root = [
    containerBackground(
      accessory ? "clear" : dark ? "#000000" : "#FFFFFF",
      "widget",
    ),
    ...(link ? [widgetURL(link)] : []),
  ];
  const emptyTitle = word(
    status === "empty"
      ? "noConventionTitle"
      : status === "noPicks"
        ? "noPicksTitle"
        : "finishedTitle",
  );
  const emptyHint = word(
    status === "empty"
      ? "noConventionHint"
      : status === "noPicks"
        ? "noPicksHint"
        : "finishedHint",
  );
  const reminderMinutes = next
    ? Math.max(1, Math.ceil((next.startAtMs - now) / 60_000))
    : 0;
  const urgency =
    next && reminderWindow
      ? `${word("startsIn")} ${format(word("compactMinutesFormat"), String(reminderMinutes))}`
      : word("upNextCaps");
  function currentTime(event: WidgetEventSnapshot): string {
    return event.endAtMs === null
      ? clock(event.startAtMs)
      : format(word("untilCapsFormat"), clock(event.endAtMs));
  }
  function reminderLabel(event: WidgetEventSnapshot): string {
    if (event.reminderMinutes === null) return "";
    return format(
      word("reminderAtFormat"),
      clock(event.startAtMs - event.reminderMinutes * 60_000),
      format(
        word("minutesBeforeFormat"),
        unit("minutes", event.reminderMinutes),
      ),
    );
  }
  const spoken =
    beforeConvention && convention
      ? `${convention.name}, ${countdown(convention.startAtMs, zone)}`
      : next
        ? `${current ? `${word("happeningNowCaps")}: ${current.title}. ` : ""}${format(word("nextEventA11yFormat"), next.title, clock(next.startAtMs, true))}. ${place(next)}. ${reminderLabel(next)}`
        : current
          ? `${word("happeningNowCaps")}, ${currentTime(current)}, ${current.title}, ${place(current)}. ${word("noLaterSavedEvents")}`
          : `${emptyTitle}. ${emptyHint}`;
  const spokenModifiers = [
    accessibilityElement("ignore"),
    accessibilityLabel(spoken),
    accessibilityHint(stale ? word("staleHint") : ""),
  ];
  function eventTitle(event: WidgetEventSnapshot, lines = 1) {
    return (
      <Text modifiers={[title, primary, lineLimit(lines), layoutPriority(1)]}>
        {event.title}
      </Text>
    );
  }
  function eventPlace(event: WidgetEventSnapshot) {
    return place(event) ? (
      <Text modifiers={[caption, secondary, lineLimit(1), layoutPriority(-1)]}>
        {place(event)}
      </Text>
    ) : null;
  }
  function timing(text: string) {
    return (
      <Text
        modifiers={[
          font({ textStyle: "caption", weight: "semibold" }),
          monospacedDigit(),
          foregroundStyle(accent),
          lineLimit(1),
          layoutPriority(2),
        ]}
      >
        {text}
      </Text>
    );
  }
  function eyebrow(text: string) {
    return (
      <Text
        modifiers={[
          font({ textStyle: "caption2", weight: "bold" }),
          foregroundStyle(accent),
          lineLimit(1),
        ]}
      >
        {text}
      </Text>
    );
  }
  function footer() {
    if (!snapshot.generatedAtMs || family === "systemSmall" || accessory)
      return null;
    const updated = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12,
    }).format(new Date(snapshot.generatedAtMs));
    return (
      <HStack
        spacing={4}
        modifiers={[
          caption,
          secondary,
          accessibilityElement("ignore"),
          accessibilityLabel(format(word("planLastUpdatedFormat"), updated)),
          accessibilityHint(stale ? word("staleHint") : ""),
        ]}
      >
        <Image systemName="clock.arrow.circlepath" />
        <Text modifiers={[lineLimit(1), monospacedDigit()]}>{updated}</Text>
        {stale ? <Image systemName="exclamationmark.triangle" /> : null}
        <Spacer />
      </HStack>
    );
  }

  if (expired || invalid) {
    const updated = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12,
    }).format(new Date(snapshot.generatedAtMs));
    const refresh = `${format(word("planLastUpdatedFormat"), updated)}. ${word("staleHint")}`;
    if (family === "accessoryInline")
      return (
        <Text modifiers={[...root, accessibilityLabel(refresh)]}>
          {word("staleHint")}
        </Text>
      );
    return (
      <VStack
        spacing={3}
        modifiers={[
          ...root,
          accessibilityElement("ignore"),
          accessibilityLabel(refresh),
        ]}
      >
        <Image
          systemName="arrow.clockwise"
          modifiers={[font({ textStyle: "caption" })]}
        />
        <Text modifiers={[caption, lineLimit(accessory ? 2 : 3)]}>
          {word("staleHint")}
        </Text>
        {!accessory ? timing(updated) : null}
      </VStack>
    );
  }
  if (family === "accessoryInline") {
    const text =
      beforeConvention && convention
        ? `${countdown(convention.startAtMs, zone)} · ${convention.name}`
        : next
          ? `${reminderWindow ? urgency : clock(next.startAtMs, true)} · ${next.title}`
          : current
            ? `${word("happeningNowCaps")} · ${currentTime(current)} · ${current.title}`
            : emptyTitle;
    return <Text modifiers={[...root, ...spokenModifiers]}>{text}</Text>;
  }
  if (family === "accessoryCircular") {
    if (beforeConvention && convention) {
      const progress = Math.max(
        0,
        Math.min(1, 1 - (convention.startAtMs - now) / (7 * 86_400_000)),
      );
      return (
        <Gauge
          value={progress}
          currentValueLabel={
            <Text
              modifiers={[
                font({ textStyle: "caption", weight: "semibold" }),
                lineLimit(1),
              ]}
            >
              {countdown(convention.startAtMs, zone, true)}
            </Text>
          }
          modifiers={[
            ...root,
            ...spokenModifiers,
            gaugeStyle("circularCapacity"),
          ]}
        >
          <Text>{convention.name}</Text>
        </Gauge>
      );
    }
    if (next && reminderWindow) {
      const progress = Math.max(
        0,
        Math.min(
          1,
          1 - (next.startAtMs - now) / ((next.reminderMinutes ?? 15) * 60_000),
        ),
      );
      return (
        <Gauge
          value={progress}
          currentValueLabel={
            <Text
              modifiers={[
                font({ textStyle: "title3", weight: "semibold" }),
                monospacedDigit(),
                lineLimit(1),
              ]}
            >
              {String(reminderMinutes)}
            </Text>
          }
          modifiers={[
            ...root,
            ...spokenModifiers,
            gaugeStyle("circularCapacity"),
          ]}
        >
          <Image systemName="bell" />
        </Gauge>
      );
    }
    return (
      <ZStack modifiers={[...root, ...spokenModifiers]}>
        <AccessoryWidgetBackground />
        <VStack spacing={1}>
          {next ? (
            <>
              {eyebrow(word("upNextCaps"))}
              {timing(clock(next.startAtMs))}
              <Text modifiers={[font({ textStyle: "title3", weight: "bold" })]}>
                {(Array.from(next.title.trim())[0] ?? "").toLocaleUpperCase(
                  locale,
                )}
              </Text>
            </>
          ) : current ? (
            <>
              {eyebrow(word("now"))}
              {timing(currentTime(current))}
            </>
          ) : (
            <Text modifiers={[caption, lineLimit(3)]}>{emptyTitle}</Text>
          )}
        </VStack>
      </ZStack>
    );
  }
  if (family === "accessoryRectangular") {
    return (
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[...root, ...spokenModifiers]}
      >
        {beforeConvention && convention ? (
          <>
            {eyebrow(convention.name)}
            {timing(countdown(convention.startAtMs, zone))}
            <Text modifiers={[caption, secondary, lineLimit(1)]}>
              {convention.dateRangeLabel}
            </Text>
          </>
        ) : next ? (
          <>
            {eyebrow(reminderWindow ? urgency : word("upNextCaps"))}
            {timing(clock(next.startAtMs, true))}
            {eventTitle(next)}
            {eventPlace(next)}
          </>
        ) : current ? (
          <>
            {eyebrow(word("happeningNowCaps"))}
            {timing(currentTime(current))}
            {eventTitle(current)}
            {eventPlace(current)}
          </>
        ) : (
          <>
            {eyebrow(emptyTitle)}
            <Text modifiers={[caption, secondary, lineLimit(2)]}>
              {emptyHint}
            </Text>
          </>
        )}
      </VStack>
    );
  }

  if (beforeConvention && convention) {
    return (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[...root, ...spokenModifiers]}
      >
        {eyebrow(word("comingUpCaps"))}
        <Text modifiers={[font({ textStyle: "headline" }), lineLimit(2)]}>
          {convention.name}
        </Text>
        <Spacer minLength={2} />
        <Text
          modifiers={[
            font({ textStyle: "title2", weight: "bold", design: "rounded" }),
            foregroundStyle(accent),
            lineLimit(1),
            layoutPriority(2),
          ]}
        >
          {countdown(convention.startAtMs, zone)}
        </Text>
        <Text
          modifiers={[font({ textStyle: "caption" }), secondary, lineLimit(1)]}
        >
          {convention.dateRangeLabel}
        </Text>
        {footer()}
      </VStack>
    );
  }
  if (!next && !current) {
    return (
      <VStack
        alignment="center"
        spacing={6}
        modifiers={[...root, ...spokenModifiers]}
      >
        <Spacer minLength={0} />
        <Image
          systemName="calendar"
          modifiers={[font({ textStyle: "title2" }), foregroundStyle(accent)]}
        />
        <Text modifiers={[font({ textStyle: "headline" }), lineLimit(2)]}>
          {emptyTitle}
        </Text>
        <Text
          modifiers={[font({ textStyle: "caption" }), secondary, lineLimit(2)]}
        >
          {emptyHint}
        </Text>
        <Spacer minLength={0} />
        {footer()}
      </VStack>
    );
  }
  if (!next && current) {
    return (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[...root, ...spokenModifiers]}
      >
        {eyebrow(word("happeningNowCaps"))}
        {timing(currentTime(current))}
        {eventTitle(current, 2)}
        {eventPlace(current)}
        <Text
          modifiers={[caption, secondary, lineLimit(1), layoutPriority(-1)]}
        >
          {word("noLaterSavedEventsShort")}
        </Text>
        <Spacer minLength={0} />
        {footer()}
      </VStack>
    );
  }
  if (!next) return <Text modifiers={root}>{emptyTitle}</Text>;
  if (family === "systemSmall") {
    return (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[...root, ...spokenModifiers]}
      >
        {eyebrow(word("upNextCaps"))}
        {timing(clock(next.startAtMs, true))}
        {eventTitle(next, 2)}
        {eventPlace(next)}
        <Spacer minLength={0} />
      </VStack>
    );
  }
  return (
    <VStack
      alignment="leading"
      spacing={3}
      modifiers={[...root, ...spokenModifiers]}
    >
      <HStack>
        <Text modifiers={[caption, foregroundStyle(accent), lineLimit(1)]}>
          {convention?.name ?? "ConPaws"}
        </Text>
        <Spacer />
        {stale ? <Image systemName="exclamationmark.triangle" /> : null}
      </HStack>
      <HStack alignment="top" spacing={12}>
        {current ? (
          <VStack alignment="leading" spacing={2}>
            {eyebrow(word("now"))}
            {eventTitle(current)}
            {timing(currentTime(current))}
          </VStack>
        ) : null}
        <VStack alignment="leading" spacing={2}>
          {eyebrow(reminderWindow ? urgency : word("upNextCaps"))}
          {timing(clock(next.startAtMs, true))}
          {eventTitle(next)}
          {!current ? eventPlace(next) : null}
        </VStack>
      </HStack>
      {family === "systemLarge"
        ? future.slice(1, 4).map((event) => (
            <VStack key={event.id} alignment="leading" spacing={2}>
              <Divider />
              <HStack spacing={8}>
                {timing(clock(event.startAtMs, true))}
                {eventTitle(event)}
              </HStack>
              {eventPlace(event)}
            </VStack>
          ))
        : null}
      <Spacer minLength={0} />
      {footer()}
    </VStack>
  );
}

export default createWidget<ConPawsWidgetProps, ConPawsWidgetConfiguration>(
  "ConPawsWidget",
  ConPawsWidgetLayout,
  {
    snapshot: {
      schemaVersion: 2,
      generatedAtMs: 0,
      localeIdentifier: "en",
      conventions: [],
    },
  },
);
