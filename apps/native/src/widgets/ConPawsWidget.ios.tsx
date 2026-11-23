import {
  AccessoryWidgetBackground,
  Divider,
  Gauge,
  HStack,
  Image,
  Label,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  accessibilityHint,
  accessibilityLabel,
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  labelsHidden,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  progressViewStyle,
  resizable,
  shapes,
  tint,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ComponentProps, ReactNode } from "react";
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
  // Tinted, clear and Lock Screen modes draw everything in one tone, and Expo
  // UI cannot mark an accent group, so there the hierarchy has to come from
  // size, weight and shape. Forcing black or white would only fight the tint.
  const monochrome =
    environment.widgetRenderingMode === "vibrant" ||
    environment.widgetRenderingMode === "accented";
  const accent = monochrome ? null : dark ? "#18B7F2" : "#00618A";
  const primary = foregroundStyle({ type: "hierarchical", style: "primary" });
  const secondary = foregroundStyle({
    type: "hierarchical",
    style: "secondary",
  });
  // The hero time is the only accent-coloured text; everywhere else the brand
  // shows as a shape (the hero card, the progress bar or the empty glyph).
  const heroColor = accent ? foregroundStyle(accent) : primary;
  const accentTint = accent ? [tint(accent)] : [];
  const eyebrowFont = font({ textStyle: "caption2", weight: "bold" });
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
    minutesBeforeFormat: "%@ min before",
    hourBefore: "1 hour before",
    atEventTime: "At event time",
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
  // Splits a one-value template into the words before and after the value, so
  // the value can be drawn large while the words stay small, in whatever order
  // the language puts them.
  function around(template: string): [string, string] {
    const parts = format(template, "\u0000").split("\u0000");
    return [parts[0]?.trim() ?? "", parts.slice(1).join("").trim()];
  }
  function unitTemplate(
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
    return (
      table?.[key as keyof WidgetPluralUnit] ??
      `%@ ${kind === "hours" ? (one ? "hour" : "hours") : kind === "days" ? (one ? "day" : "days") : kind === "months" ? (one ? "month" : "months") : one ? "minute" : "minutes"}`
    );
  }
  function unit(
    kind: "hours" | "days" | "months" | "minutes",
    count: number,
    oblique = false,
  ): string {
    return format(unitTemplate(kind, count, oblique), String(count));
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
  function monthsBetween(timestamp: number, timeZone: string): number {
    const [year, month, day] = calendarParts(timestamp, timeZone);
    const [fromYear, fromMonth, fromDay] = calendarParts(now, timeZone);
    return (year - fromYear) * 12 + month - fromMonth - (day < fromDay ? 1 : 0);
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
    const months = monthsBetween(timestamp, timeZone);
    if (days >= 30 && months >= 1)
      return compact
        ? format(word("compactMonthsFormat"), String(months))
        : format(word("inFormat"), unit("months", months, true));
    return compact
      ? format(word("compactDaysFormat"), String(days))
      : format(word("inFormat"), unit("days", days, true));
  }
  // The same thresholds as countdown(), returning the number on its own when
  // there is a whole day count to make the hero of; under two days the
  // countdown words ("Tomorrow", "In 5 hours") are the hero instead.
  function dayCount(
    timestamp: number,
    timeZone: string,
  ): { count: number; kind: "days" | "months" } | null {
    if (timestamp - now < 86_400_000) return null;
    const days = dayNumber(timestamp, timeZone) - dayNumber(now, timeZone);
    if (days <= 1) return null;
    const months = monthsBetween(timestamp, timeZone);
    return days >= 30 && months >= 1
      ? { count: months, kind: "months" }
      : { count: days, kind: "days" };
  }
  function end(event: WidgetEventSnapshot): number {
    return event.endAtMs ?? event.startAtMs + 3_600_000;
  }
  // The room is what changes from panel to panel; the venue is usually the
  // same for the whole convention, so it is shown only when there is no room.
  function place(event: WidgetEventSnapshot): string {
    return event.room?.trim() || event.location?.trim() || "";
  }
  const configuration = environment.configuration;
  // A saved panel keeps its convention until it ends, as on the Watch
  // (ConPawsScheduleResolver.lastActiveMs): a closing-night panel often runs
  // past the end, the midnight after the last day. It counts for a day from
  // its start at most, so a bad end time cannot hide the next convention.
  const candidates = conventions.filter(
    (convention) =>
      convention.endAtMs >= now ||
      convention.events.some(
        (event) =>
          event.startAtMs >= now ||
          Math.min(end(event), event.startAtMs + 86_400_000) > now,
      ),
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
  function sameDay(timestamp: number): boolean {
    return dayNumber(timestamp, zone) === dayNumber(now, zone);
  }
  function clock(timestamp: number, includeDay = false): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12,
    };
    if (includeDay && !sameDay(timestamp)) options.weekday = "short";
    return new Intl.DateTimeFormat(locale, options).format(new Date(timestamp));
  }
  // A circle has room for the digits and one short line: the digits go large
  // and the AM/PM marker and any weekday share the small line underneath.
  function compactClock(timestamp: number): [string, string] {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12,
    }).formatToParts(new Date(timestamp));
    const digits = parts
      .filter((part) => part.type !== "dayPeriod")
      .map((part) => part.value)
      .join("")
      .trim();
    const period = parts.find((part) => part.type === "dayPeriod")?.value ?? "";
    const weekday = sameDay(timestamp)
      ? ""
      : new Intl.DateTimeFormat(locale, {
          timeZone: zone,
          weekday: "short",
        }).format(new Date(timestamp));
    return [digits, [weekday, period].filter(Boolean).join(" ")];
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
    next.reminderMinutes != null &&
    next.reminderMinutes > 0 &&
    now >= next.startAtMs - next.reminderMinutes * 60_000;
  // One hero per widget. A reminder that has fired outranks the panel the
  // user is sitting in, because it means it is time to move; a panel with a
  // real end outranks the next one; an open-ended one (a lounge with no end
  // time) only leads when nothing else is planned.
  const kind =
    beforeConvention && convention
      ? "countdown"
      : next && reminderWindow
        ? "reminder"
        : current && current.endAtMs != null
          ? "now"
          : next
            ? "next"
            : current
              ? "open"
              : convention
                ? events.length > 0
                  ? "finished"
                  : "noPicks"
                : "empty";
  const heroEvent =
    kind === "reminder" || kind === "next"
      ? next
      : kind === "now" || kind === "open"
        ? current
        : undefined;
  const following =
    kind === "reminder" || kind === "next" ? future.slice(1) : future;
  const scheme = snapshot.presentation?.appScheme;
  const link = scheme
    ? convention
      ? `${scheme}://convention/${encodeURIComponent(convention.id)}`
      : `${scheme}://`
    : undefined;
  const stale =
    snapshot.generatedAtMs > 0 && now - snapshot.generatedAtMs >= 30 * 60_000;
  const updated =
    snapshot.generatedAtMs > 0
      ? new Intl.DateTimeFormat(locale, {
          hour: "numeric",
          minute: "2-digit",
          hour12,
        }).format(new Date(snapshot.generatedAtMs))
      : "";
  // A faint brand wash rather than flat white or black. It is the container
  // background, so the system removes it in tinted, clear and StandBy modes.
  const surface = accessory
    ? "clear"
    : {
        type: "linearGradient" as const,
        colors: dark ? ["#0A0C0F", "#0B1E2A"] : ["#FFFFFF", "#E6F2F9"],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 },
      };
  const root = [
    containerBackground(surface, "widget"),
    ...(link ? [widgetURL(link)] : []),
  ];
  const fill = accessory
    ? []
    : [
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
          alignment: "topLeading",
        }),
      ];
  const emptyTitle = word(
    kind === "empty"
      ? "noConventionTitle"
      : kind === "noPicks"
        ? "noPicksTitle"
        : "finishedTitle",
  );
  const emptyHint = word(
    kind === "empty"
      ? "noConventionHint"
      : kind === "noPicks"
        ? "noPicksHint"
        : "finishedHint",
  );
  const emptyGlyph =
    kind === "empty"
      ? "calendar.badge.plus"
      : kind === "noPicks"
        ? "star"
        : "checkmark.circle";
  const reminderMinutes = next
    ? Math.max(1, Math.ceil((next.startAtMs - now) / 60_000))
    : 0;
  const urgency = `${word("startsIn")} ${format(word("compactMinutesFormat"), String(reminderMinutes))}`;
  const eyebrowText =
    kind === "countdown"
      ? word("comingUpCaps")
      : kind === "reminder"
        ? urgency
        : kind === "now" || kind === "open"
          ? word("happeningNowCaps")
          : word("upNextCaps");
  const heroTime = !heroEvent
    ? ""
    : kind === "now"
      ? clock(end(heroEvent), true)
      : clock(heroEvent.startAtMs, true);
  // "UNTIL %@" puts its words before the time in some languages and after it
  // in others; both halves stay small beside the large time.
  const [untilBefore, untilAfter] =
    kind === "now" ? around(word("untilCapsFormat")) : ["", ""];
  function reminderLabel(event: WidgetEventSnapshot): string {
    const minutes = event.reminderMinutes;
    if (minutes == null) return "";
    // Worded like the phone picker and the Watch: the table copies the app's
    // `reminders.atTime` and `reminders.hourBefore` for 0 and 60, and
    // `reminders.minutesBefore`, which takes the bare number ("10 min
    // before", "За 10 мин"), for the rest.
    const offset =
      minutes === 0
        ? word("atEventTime")
        : minutes === 60
          ? word("hourBefore")
          : format(word("minutesBeforeFormat"), String(minutes));
    return format(
      word("reminderAtFormat"),
      clock(event.startAtMs - minutes * 60_000),
      offset,
    );
  }
  function sentence(...parts: string[]): string {
    return parts.filter(Boolean).join(". ");
  }
  const spoken = sentence(
    kind === "countdown" && convention
      ? `${convention.name}, ${countdown(convention.startAtMs, zone)}`
      : next
        ? sentence(
            current ? `${word("happeningNowCaps")}: ${current.title}` : "",
            format(
              word("nextEventA11yFormat"),
              next.title,
              clock(next.startAtMs, true),
            ),
            place(next),
            reminderLabel(next),
          )
        : current
          ? sentence(
              [
                word("happeningNowCaps"),
                current.endAtMs != null
                  ? format(word("untilCapsFormat"), clock(current.endAtMs))
                  : clock(current.startAtMs),
                current.title,
                place(current),
              ]
                .filter(Boolean)
                .join(", "),
              word("noLaterSavedEvents"),
            )
          : sentence(emptyTitle, emptyHint),
    stale ? format(word("planLastUpdatedFormat"), updated) : "",
  );
  const spokenModifiers = [
    accessibilityElement("ignore"),
    accessibilityLabel(spoken),
    accessibilityHint(stale ? word("staleHint") : ""),
  ];

  function small(text: string) {
    return text ? (
      <Text modifiers={[eyebrowFont, secondary, lineLimit(1)]}>{text}</Text>
    ) : null;
  }
  // The ConPaws mark from the extension's asset catalog. It is a template
  // image, so it takes the row's colour and the tinted Home Screen's accent.
  // Its compass ring blurs below 16 points, so it does not shrink with the
  // caption beside it.
  function brandMark() {
    return (
      <Image
        assetName="ConPawsMark"
        modifiers={[resizable(), frame({ width: 16, height: 16 }), secondary]}
      />
    );
  }
  function eyebrowRow(withMark: boolean) {
    return (
      <HStack spacing={4}>
        {kind === "reminder" ? (
          <Image systemName="bell.fill" modifiers={[eyebrowFont, secondary]} />
        ) : null}
        {small(eyebrowText)}
        <Spacer minLength={4} />
        {withMark ? brandMark() : null}
      </HStack>
    );
  }
  function heroText(
    text: string,
    textStyle: "largeTitle" | "title" | "title2" | "headline",
  ) {
    return (
      <Text
        modifiers={[
          font({ textStyle, weight: "bold", design: "rounded" }),
          monospacedDigit(),
          heroColor,
          lineLimit(1),
          // A time that does not fit shrinks rather than losing digits.
          minimumScaleFactor(0.6),
          layoutPriority(2),
        ]}
      >
        {text}
      </Text>
    );
  }
  function hero(textStyle: "title" | "title2" | "headline") {
    return (
      <HStack alignment="firstTextBaseline" spacing={4}>
        {small(untilBefore)}
        {heroText(heroTime, textStyle)}
        {small(untilAfter)}
      </HStack>
    );
  }
  function countHero(textStyle: "largeTitle" | "title") {
    if (!convention) return null;
    const count = dayCount(convention.startAtMs, zone);
    if (!count)
      return heroText(
        countdown(convention.startAtMs, zone),
        textStyle === "largeTitle" ? "title2" : "title",
      );
    const [before, after] = around(unitTemplate(count.kind, count.count));
    const unitWords = (text: string) =>
      text ? (
        <Text
          modifiers={[
            font({ textStyle: "headline" }),
            secondary,
            lineLimit(1),
            layoutPriority(1),
          ]}
        >
          {text}
        </Text>
      ) : null;
    return (
      <HStack alignment="firstTextBaseline" spacing={4}>
        {unitWords(before)}
        {heroText(String(count.count), textStyle)}
        {unitWords(after)}
      </HStack>
    );
  }
  function eventTitle(
    event: WidgetEventSnapshot,
    lines: number,
    textStyle: "headline" | "subheadline" | "footnote",
  ) {
    return (
      <Text
        modifiers={[
          font({ textStyle, weight: "semibold" }),
          primary,
          lineLimit(lines),
          layoutPriority(1),
        ]}
      >
        {event.title}
      </Text>
    );
  }
  function quiet(text: string, lines = 1) {
    return text ? (
      <Text
        modifiers={[
          font({ textStyle: "footnote" }),
          secondary,
          lineLimit(lines),
          layoutPriority(-1),
        ]}
      >
        {text}
      </Text>
    ) : null;
  }
  function progress() {
    // Only a real end gets a bar; an open-ended panel never has one invented.
    if (kind !== "now" || !current || current.endAtMs == null) return null;
    return (
      <ProgressView
        timerInterval={{
          lower: new Date(current.startAtMs),
          upper: new Date(current.endAtMs),
        }}
        countsDown={false}
        modifiers={[progressViewStyle("linear"), labelsHidden(), ...accentTint]}
      />
    );
  }
  // Freshness is only worth a line when it is in doubt.
  function staleLine() {
    if (!stale) return null;
    return (
      <HStack spacing={4}>
        <Image
          systemName="arrow.clockwise"
          modifiers={[font({ textStyle: "caption2" }), secondary]}
        />
        <Text
          modifiers={[font({ textStyle: "caption2" }), secondary, lineLimit(2)]}
        >
          {word("staleHint")}
        </Text>
      </HStack>
    );
  }
  // Agenda rows put the time above the title so a large text size wraps the
  // title instead of squeezing the time; the room shares the time's line and
  // gives way first.
  function row(event: WidgetEventSnapshot, withRoom: boolean) {
    const room = withRoom ? event.room?.trim() : "";
    return (
      <VStack key={event.id} alignment="leading" spacing={1}>
        <HStack spacing={4}>
          <Text
            modifiers={[
              font({ textStyle: "caption", weight: "semibold" }),
              monospacedDigit(),
              secondary,
              lineLimit(1),
              layoutPriority(2),
            ]}
          >
            {clock(event.startAtMs, true)}
          </Text>
          {room ? (
            <Text
              modifiers={[
                font({ textStyle: "caption" }),
                secondary,
                lineLimit(1),
                layoutPriority(-1),
              ]}
            >
              {`· ${room}`}
            </Text>
          ) : null}
          <Spacer minLength={0} />
        </HStack>
        {/* The medium column is narrow but has the height for a second line. */}
        {eventTitle(
          event,
          withRoom ? 1 : 2,
          withRoom ? "subheadline" : "footnote",
        )}
      </VStack>
    );
  }
  function header() {
    if (!convention) return null;
    return (
      <HStack alignment="top" spacing={8}>
        <VStack alignment="leading" spacing={0}>
          <Text
            modifiers={[
              font({ textStyle: "subheadline", weight: "semibold" }),
              primary,
              lineLimit(1),
            ]}
          >
            {convention.name}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: "caption" }),
              secondary,
              lineLimit(1),
            ]}
          >
            {convention.dateRangeLabel}
          </Text>
        </VStack>
        <Spacer minLength={4} />
        {brandMark()}
      </HStack>
    );
  }
  function card(children: ReactNode) {
    return (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[
          padding({ all: 12 }),
          frame({ maxWidth: Infinity, alignment: "leading" }),
          background(
            accent
              ? `${accent}1F`
              : { type: "hierarchical", style: "quaternary" },
            shapes.roundedRectangle({
              cornerRadius: 16,
              roundedCornerStyle: "continuous",
            }),
          ),
        ]}
      >
        {children}
      </VStack>
    );
  }

  if (expired || invalid) {
    const refresh = sentence(
      updated ? format(word("planLastUpdatedFormat"), updated) : "",
      word("staleHint"),
    );
    if (family === "accessoryInline")
      return (
        <Label
          title={word("staleHint")}
          systemImage="arrow.clockwise"
          modifiers={[...root, accessibilityLabel(refresh)]}
        />
      );
    if (family === "accessoryCircular")
      return (
        <ZStack
          modifiers={[
            ...root,
            accessibilityElement("ignore"),
            accessibilityLabel(refresh),
          ]}
        >
          <AccessoryWidgetBackground />
          <Image
            systemName="arrow.clockwise"
            modifiers={[font({ textStyle: "title3", weight: "semibold" })]}
          />
        </ZStack>
      );
    return (
      <VStack
        alignment={accessory ? "leading" : "center"}
        spacing={4}
        modifiers={[
          ...root,
          ...(accessory
            ? []
            : [
                frame({
                  maxWidth: Infinity,
                  maxHeight: Infinity,
                  alignment: "center",
                }),
              ]),
          accessibilityElement("ignore"),
          accessibilityLabel(refresh),
        ]}
      >
        <Image
          systemName="arrow.clockwise"
          modifiers={[
            font({ textStyle: accessory ? "caption" : "title2" }),
            heroColor,
          ]}
        />
        <Text
          modifiers={[
            font({ textStyle: accessory ? "footnote" : "headline" }),
            primary,
            multilineTextAlignment(accessory ? "leading" : "center"),
            lineLimit(3),
          ]}
        >
          {word("staleHint")}
        </Text>
        {!accessory && updated ? (
          <Text
            modifiers={[
              font({ textStyle: "caption" }),
              secondary,
              multilineTextAlignment("center"),
              lineLimit(2),
            ]}
          >
            {format(word("planLastUpdatedFormat"), updated)}
          </Text>
        ) : null}
      </VStack>
    );
  }

  if (family === "accessoryInline") {
    const [symbol, text]: [
      ComponentProps<typeof Label>["systemImage"],
      string,
    ] =
      kind === "countdown" && convention
        ? [
            "calendar",
            `${countdown(convention.startAtMs, zone)} · ${convention.name}`,
          ]
        : kind === "reminder" && next
          ? ["bell.fill", `${urgency} · ${next.title}`]
          : kind === "now" && current
            ? [
                "clock",
                `${format(word("untilCapsFormat"), heroTime)} · ${current.title}`,
              ]
            : kind === "open" && current
              ? ["clock", `${word("now")} · ${current.title}`]
              : next
                ? ["clock", `${heroTime} · ${next.title}`]
                : ["pawprint.fill", emptyTitle];
    return (
      <Label
        title={text}
        systemImage={symbol}
        modifiers={[...root, ...spokenModifiers]}
      />
    );
  }

  if (family === "accessoryCircular") {
    if (kind === "countdown" && convention) {
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
                font({
                  textStyle: "caption",
                  weight: "bold",
                  design: "rounded",
                }),
                lineLimit(1),
                minimumScaleFactor(0.6),
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
    if (kind === "reminder" && next) {
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
                font({
                  textStyle: "title3",
                  weight: "bold",
                  design: "rounded",
                }),
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
          <Image
            systemName="bell.fill"
            modifiers={[font({ textStyle: "caption2" })]}
          />
        </Gauge>
      );
    }
    if (kind === "now" && current && current.endAtMs != null) {
      // The ring fills as the panel runs; the centre is when it ends.
      const length = Math.max(1, current.endAtMs - current.startAtMs);
      const [digits] = compactClock(current.endAtMs);
      return (
        <Gauge
          value={Math.max(0, Math.min(1, (now - current.startAtMs) / length))}
          currentValueLabel={
            <Text
              modifiers={[
                font({
                  textStyle: "caption",
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                lineLimit(1),
                minimumScaleFactor(0.6),
              ]}
            >
              {digits}
            </Text>
          }
          modifiers={[
            ...root,
            ...spokenModifiers,
            gaugeStyle("circularCapacity"),
          ]}
        >
          <Text>{current.title}</Text>
        </Gauge>
      );
    }
    const [digits, detail] = heroEvent
      ? compactClock(heroEvent.startAtMs)
      : ["", ""];
    return (
      <ZStack modifiers={[...root, ...spokenModifiers]}>
        <AccessoryWidgetBackground />
        {heroEvent ? (
          <VStack spacing={0}>
            {kind === "open" ? (
              <Text modifiers={[eyebrowFont, lineLimit(1)]}>
                {word("compactNow")}
              </Text>
            ) : (
              <Image
                systemName="calendar"
                modifiers={[font({ textStyle: "caption2" })]}
              />
            )}
            <Text
              modifiers={[
                font({
                  textStyle: "headline",
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                lineLimit(1),
                minimumScaleFactor(0.5),
              ]}
            >
              {digits}
            </Text>
            {detail ? (
              <Text
                modifiers={[
                  font({ textStyle: "caption2" }),
                  lineLimit(1),
                  minimumScaleFactor(0.6),
                ]}
              >
                {detail}
              </Text>
            ) : null}
          </VStack>
        ) : (
          <Text
            modifiers={[
              font({ textStyle: "caption2" }),
              multilineTextAlignment("center"),
              lineLimit(3),
              minimumScaleFactor(0.7),
            ]}
          >
            {emptyTitle}
          </Text>
        )}
      </ZStack>
    );
  }

  if (family === "accessoryRectangular") {
    // Three lines: what and when, the title, then where.
    const lead = kind === "now" ? untilBefore : eyebrowText;
    const time =
      kind === "countdown" && convention
        ? countdown(convention.startAtMs, zone)
        : heroTime;
    return (
      <VStack
        alignment="leading"
        spacing={1}
        modifiers={[
          ...root,
          ...spokenModifiers,
          frame({ maxWidth: Infinity, alignment: "leading" }),
        ]}
      >
        {kind === "countdown" || heroEvent ? (
          <>
            <HStack alignment="firstTextBaseline" spacing={4}>
              {kind === "reminder" ? (
                <Image
                  systemName="bell.fill"
                  modifiers={[eyebrowFont, secondary]}
                />
              ) : null}
              {small(lead)}
              {heroText(time, "headline")}
              {small(untilAfter)}
              <Spacer minLength={0} />
            </HStack>
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "semibold" }),
                primary,
                lineLimit(1),
                layoutPriority(1),
              ]}
            >
              {heroEvent?.title ?? convention?.name ?? ""}
            </Text>
            {quiet(
              heroEvent ? place(heroEvent) : (convention?.dateRangeLabel ?? ""),
            )}
          </>
        ) : (
          <>
            <HStack spacing={4}>
              <Image
                systemName={emptyGlyph}
                modifiers={[font({ textStyle: "caption", weight: "semibold" })]}
              />
              <Text
                modifiers={[
                  font({ textStyle: "subheadline", weight: "semibold" }),
                  lineLimit(1),
                ]}
              >
                {emptyTitle}
              </Text>
            </HStack>
            {quiet(emptyHint, 2)}
          </>
        )}
      </VStack>
    );
  }

  if (kind === "countdown" && convention) {
    const plan = future.slice(0, family === "systemLarge" ? 3 : 2);
    const planBlock = (
      <VStack alignment="leading" spacing={8} modifiers={fill}>
        {plan.map((event) => row(event, family === "systemLarge"))}
        {plan.length === 0 ? quiet(word("noPicksHint"), 3) : null}
      </VStack>
    );
    if (family === "systemLarge")
      return (
        <VStack
          alignment="leading"
          spacing={12}
          modifiers={[...root, ...spokenModifiers, ...fill]}
        >
          {header()}
          {card(
            <>
              {small(eyebrowText)}
              {countHero("largeTitle")}
            </>,
          )}
          {planBlock}
          {staleLine()}
        </VStack>
      );
    const countdownBlock = (modifiers: ReturnType<typeof font>[]) => (
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[...modifiers, ...fill]}
      >
        {eyebrowRow(true)}
        {countHero("largeTitle")}
        <Spacer minLength={4} />
        <Text
          modifiers={[
            font({ textStyle: "headline" }),
            primary,
            lineLimit(2),
            layoutPriority(1),
          ]}
        >
          {convention.name}
        </Text>
        {quiet(convention.dateRangeLabel)}
        {family === "systemSmall" ? staleLine() : null}
      </VStack>
    );
    if (family === "systemSmall")
      return countdownBlock([...root, ...spokenModifiers]);
    return (
      <HStack
        alignment="top"
        spacing={12}
        modifiers={[...root, ...spokenModifiers, ...fill]}
      >
        {countdownBlock([])}
        <Divider />
        <VStack alignment="leading" spacing={8} modifiers={fill}>
          {plan.map((event) => row(event, false))}
          {plan.length === 0 ? quiet(word("noPicksHint"), 3) : null}
          <Spacer minLength={0} />
          {staleLine()}
        </VStack>
      </HStack>
    );
  }

  if (!heroEvent) {
    const large = family === "systemLarge";
    return (
      // A small widget has about 138 points of height. A title2 glyph, a
      // title that wraps and a three-line hint need more, so the hint was cut
      // mid-word; the small size takes a smaller glyph and tighter spacing,
      // and the hint shrinks a little before it truncates.
      <VStack
        alignment="center"
        spacing={family === "systemSmall" ? 4 : 6}
        modifiers={[...root, ...spokenModifiers, ...fill]}
      >
        {large ? header() : null}
        <Spacer minLength={0} />
        <Image
          systemName={emptyGlyph}
          modifiers={[
            font({
              textStyle: large
                ? "title"
                : family === "systemSmall"
                  ? "title3"
                  : "title2",
            }),
            heroColor,
          ]}
        />
        <Text
          modifiers={[
            font({ textStyle: "headline" }),
            primary,
            multilineTextAlignment("center"),
            lineLimit(2),
            layoutPriority(1),
          ]}
        >
          {emptyTitle}
        </Text>
        <Text
          modifiers={[
            font({ textStyle: "footnote" }),
            secondary,
            multilineTextAlignment("center"),
            lineLimit(3),
            minimumScaleFactor(0.85),
          ]}
        >
          {emptyHint}
        </Text>
        <Spacer minLength={0} />
        {staleLine()}
      </VStack>
    );
  }

  if (family === "systemLarge") {
    const rows = following.slice(0, 3);
    const remainingToday =
      convention?.remainingTodayCount ??
      future.filter((event) => sameDay(event.startAtMs)).length;
    const shownToday = [heroEvent, ...rows].filter(
      (event) => event.startAtMs > now && sameDay(event.startAtMs),
    ).length;
    const more = Math.max(0, remainingToday - shownToday);
    return (
      <VStack
        alignment="leading"
        spacing={12}
        modifiers={[...root, ...spokenModifiers, ...fill]}
      >
        {header()}
        {card(
          <>
            {eyebrowRow(false)}
            {hero("title")}
            {eventTitle(heroEvent, 2, "headline")}
            {quiet(place(heroEvent))}
            {progress()}
          </>,
        )}
        <VStack alignment="leading" spacing={8}>
          {rows.map((event) => row(event, true))}
          {rows.length === 0 ? quiet(word("noLaterSavedEvents"), 2) : null}
          {more > 0
            ? quiet(format(word("moreTodayFormat"), String(more)))
            : null}
        </VStack>
        {staleLine()}
      </VStack>
    );
  }

  const heroBlock = (modifiers: ReturnType<typeof font>[]) => (
    <VStack alignment="leading" spacing={3} modifiers={[...modifiers, ...fill]}>
      {eyebrowRow(true)}
      {hero("title2")}
      {eventTitle(heroEvent, 2, "headline")}
      <Spacer minLength={0} />
      {quiet(place(heroEvent))}
      {progress()}
      {family === "systemSmall" ? staleLine() : null}
    </VStack>
  );
  if (family === "systemSmall") return heroBlock([...root, ...spokenModifiers]);
  const later = following.slice(0, 2);
  return (
    <HStack
      alignment="top"
      spacing={12}
      modifiers={[...root, ...spokenModifiers, ...fill]}
    >
      {heroBlock([])}
      <Divider />
      <VStack alignment="leading" spacing={8} modifiers={fill}>
        {later.length > 0 && (kind === "now" || kind === "open")
          ? small(word("upNextCaps"))
          : null}
        {later.map((event) => row(event, false))}
        {later.length === 0 ? quiet(word("noLaterSavedEventsShort"), 3) : null}
        <Spacer minLength={0} />
        {staleLine()}
      </VStack>
    </HStack>
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
