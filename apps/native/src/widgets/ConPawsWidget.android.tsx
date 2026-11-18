import {
  Button,
  Column,
  Image,
  LinearProgressIndicator,
  Row,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  size,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ReactNode } from "react";
import type { WidgetEventSnapshot } from "@/services/widget-snapshot";
import type { ConPawsWidgetProps } from "./ConPawsWidget.types";

/**
 * Self-contained because Expo evaluates this function in its isolated widget
 * runtime. Glance cannot tell the layout its size or the font scale, so one
 * layout serves every size: the most important line comes first, because the
 * bottom is what a short widget or a large text size clips.
 */
export function ConPawsWidgetLayout(
  props: ConPawsWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";
  const snapshot = props.snapshot;
  const now = Date.now();
  const valid =
    [1, 2].includes(snapshot?.schemaVersion) &&
    Array.isArray(snapshot?.conventions);
  const conventions = valid ? snapshot.conventions : [];
  function endOf(event: WidgetEventSnapshot): number {
    return event.endAtMs ?? event.startAtMs + 3_600_000;
  }
  const ordered = [...conventions].sort(
    (a, b) => a.startAtMs - b.startAtMs || a.id.localeCompare(b.id),
  );
  const eligible = ordered.filter(
    (convention) =>
      convention.endAtMs >= now ||
      convention.events.some((event) => endOf(event) > now),
  );
  const withPicks = eligible.filter((convention) =>
    convention.events.some((event) => endOf(event) > now),
  );
  const underway = withPicks.filter(
    (convention) => convention.startAtMs <= now,
  );
  const convention =
    (underway.length ? underway : withPicks.length ? withPicks : eligible)[0] ??
    [...ordered].sort((a, b) => b.endAtMs - a.endAtMs)[0];
  const events = [...(convention?.events ?? [])].sort(
    (a, b) => a.startAtMs - b.startAtMs || a.id.localeCompare(b.id),
  );
  const current = events
    .filter((event) => event.startAtMs <= now && endOf(event) > now)
    .at(-1);
  const future = events.filter((event) => event.startAtMs > now);
  const next = future[0];
  const reminderWindow =
    next != null &&
    next.reminderMinutes != null &&
    next.reminderMinutes > 0 &&
    now >= next.startAtMs - next.reminderMinutes * 60_000;
  // One hero per widget, chosen as on iOS: a reminder that has fired means it
  // is time to move; a panel with a real end outranks the next one; an
  // open-ended one only leads when nothing else is planned.
  const kind =
    !valid || props.expired
      ? "refresh"
      : convention && convention.startAtMs > now
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
  const then = kind === "refresh" ? undefined : following[0];

  const presentation = snapshot?.presentation;
  const dark =
    presentation?.appearance === "dark" ||
    (presentation?.appearance !== "light" &&
      environment.colorScheme === "dark");
  const palette =
    presentation?.palette?.[dark ? "dark" : "light"] ??
    (dark
      ? {
          background: "#101518",
          foreground: "#DFE3E7",
          secondary: "#C1C7CD",
          accent: "#18B7F2",
        }
      : {
          background: "#F2F7FC",
          foreground: "#171C20",
          secondary: "#41484D",
          accent: "#005575",
        });
  // Mixes `amount` of one #RRGGBB colour over another, for snapshots stored
  // before the palette carried its container roles.
  function blend(top: string, bottom: string, amount: number): string {
    const channels = (color: string) =>
      [1, 3, 5].map((index) =>
        Number.parseInt(color.slice(index, index + 2), 16),
      );
    const a = channels(top);
    const b = channels(bottom);
    if ([...a, ...b].some((value) => Number.isNaN(value))) return bottom;
    return `#${a
      .map((value, index) =>
        Math.round(value * amount + b[index] * (1 - amount))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  }
  const surface = palette.background;
  const onSurface = palette.foreground;
  const variant = palette.secondary;
  const primary = palette.accent;
  const container =
    palette.container ?? blend(palette.accent, palette.background, 0.16);
  const onContainer = palette.onContainer ?? palette.foreground;
  const track =
    palette.track ?? blend(palette.foreground, palette.background, 0.12);

  const labels = presentation?.labels;
  const fallback = {
    next: "Up next",
    current: "Happening now",
    noEvents: "No panels picked yet",
    finished: "You're all caught up",
    until: "Until {time}",
    nextAt: "Next · {time}",
    startsInMinutes: "Starts in {minutes} min",
    today: "Today",
    tomorrow: "Tomorrow",
    inDays: "In {count} days",
    checkedAt: "checked {time}",
    noConvention: "No conventions yet",
    noConventionHint:
      "Find your convention to start planning, or add a schedule from a link or file.",
    noEventsHint:
      "Browse a convention's schedule and choose the panels you want to catch. They'll show up here.",
    finishedHint: "All your saved panels at {name} have ended.",
  };
  function word(key: keyof typeof fallback): string {
    return labels?.[key] || fallback[key];
  }
  function fill(template: string, slot: string, value: string): string {
    return template.split(`{${slot}}`).join(value);
  }

  const zone = convention?.timeZoneIdentifier ?? "UTC";
  const locale = snapshot?.localeIdentifier || "en";
  const hour12 =
    snapshot?.timeFormat === "12"
      ? true
      : snapshot?.timeFormat === "24"
        ? false
        : presentation?.hour12;
  function dayNumber(timestamp: number, timeZone?: string): number {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    };
    if (timeZone) options.timeZone = timeZone;
    // en-US numeric dates are month/day/year; only the digits are read, so
    // direction marks or separators cannot change the result.
    const [month, day, year] = (
      new Intl.DateTimeFormat("en-US", options)
        .format(new Date(timestamp))
        .match(/\d+/g) ?? []
    ).map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  }
  // A no-break space would keep "11:00 PM" on one line even when it cannot
  // fit, and Android then breaks inside the digits. With a plain space the
  // digits stay whole and only the day period can move to the next line.
  function clock(timestamp: number, includeDay = false): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12,
    };
    if (includeDay && dayNumber(timestamp, zone) !== dayNumber(now, zone))
      options.weekday = "short";
    return new Intl.DateTimeFormat(locale, options)
      .format(new Date(timestamp))
      .replace(/[  ]/g, " ");
  }
  // The room is what changes from panel to panel; the venue is usually the
  // same for the whole convention, so it is shown only when there is no room.
  function place(event: WidgetEventSnapshot): string {
    return event.room?.trim() || event.location?.trim() || "";
  }

  // The widget redraws from the whole saved plan at every boundary, so time
  // alone does not age it; only schedule changes the app has not fetched do.
  // Half a day without opening the app is when that becomes worth a line.
  const stale =
    kind !== "refresh" &&
    snapshot.generatedAtMs > 0 &&
    now - snapshot.generatedAtMs >= 12 * 3_600_000;
  const updated =
    snapshot?.generatedAtMs > 0
      ? new Intl.DateTimeFormat(locale, {
          hour: "numeric",
          minute: "2-digit",
          hour12,
          ...(dayNumber(snapshot.generatedAtMs) === dayNumber(now)
            ? {}
            : { month: "short", day: "numeric" }),
        })
          .format(new Date(snapshot.generatedAtMs))
          .replace(/[  ]/g, " ")
      : "";

  const eyebrow =
    kind === "reminder" && next
      ? fill(
          word("startsInMinutes"),
          "minutes",
          String(Math.max(1, Math.ceil((next.startAtMs - now) / 60_000))),
        )
      : kind === "now" || kind === "open"
        ? word("current")
        : word("next");
  const heroTime = !heroEvent
    ? ""
    : kind === "now"
      ? fill(word("until"), "time", clock(endOf(heroEvent), true))
      : clock(heroEvent.startAtMs, true);
  // Only a real end gets a bar; an open-ended panel never has one invented.
  const progress =
    kind === "now" && current && current.endAtMs != null
      ? Math.max(
          0,
          Math.min(
            1,
            (now - current.startAtMs) /
              Math.max(1, current.endAtMs - current.startAtMs),
          ),
        )
      : null;

  function gap(dp: number) {
    return <Spacer modifiers={[height(dp)]} />;
  }
  function header() {
    if (!convention) return null;
    return (
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Image
          source={{ uri: "widget_mark" }}
          tint={primary}
          modifiers={[size(16, 16)]}
        />
        <Spacer modifiers={[width(6)]} />
        <Text color={variant} style={{ fontSize: 13 }} maxLines={1}>
          {convention.name}
        </Text>
      </Row>
    );
  }
  // Freshness is only worth a line when it is in doubt.
  function staleStrip() {
    if (!stale) return null;
    return (
      <Row
        verticalAlignment="center"
        modifiers={[
          fillMaxWidth(),
          background(track),
          cornerRadius(12),
          padding(8, 4, 8, 4),
        ]}
      >
        <Image
          source={{ uri: "widget_refresh" }}
          tint={variant}
          modifiers={[size(14, 14)]}
        />
        <Spacer modifiers={[width(6)]} />
        <Text color={variant} style={{ fontSize: 12 }} maxLines={1}>
          {fill(word("checkedAt"), "time", updated)}
        </Text>
      </Row>
    );
  }
  function card(children: ReactNode) {
    return (
      <Column
        modifiers={[
          fillMaxWidth(),
          background(container),
          cornerRadius(16),
          paddingAll(12),
        ]}
      >
        {children}
      </Column>
    );
  }
  // The following event shares one quiet line. It may wrap to a second line
  // rather than cut a time short at large text sizes; it is the first thing a
  // short widget clips.
  //
  // Glance cannot tell the layout its height, and has no weight modifier. As
  // the last child, a fill-height column takes whatever height is left, so the
  // line sits on the widget's bottom edge: a tall widget's spare room becomes
  // space between the card and this footer instead of a blank band under it,
  // and a short widget leaves the column no spare room at all.
  function thenLine() {
    if (!then) return null;
    return (
      <Column modifiers={[fillMaxSize()]} verticalAlignment="bottom">
        {gap(8)}
        <Text color={variant} style={{ fontSize: 13 }} maxLines={2}>
          {`${fill(word("nextAt"), "time", clock(then.startAtMs, true))} · ${then.title}`}
        </Text>
      </Column>
    );
  }
  function eventCard(event: WidgetEventSnapshot) {
    const where = place(event);
    return card(
      <>
        <Text
          color={onContainer}
          style={{ fontSize: 12, fontWeight: "bold" }}
          maxLines={1}
        >
          {eyebrow}
        </Text>
        {gap(2)}
        {/* The hero comes before the title so it is never the line clipped.
            Its generous line limit lets a weekday or day period wrap instead
            of ending a clock in an ellipsis at 200% text. */}
        <Text
          color={onContainer}
          style={{ fontSize: 24, fontWeight: "bold" }}
          maxLines={4}
        >
          {heroTime}
        </Text>
        {gap(4)}
        <Text
          color={onContainer}
          style={{ fontSize: 16, fontWeight: "bold" }}
          maxLines={2}
        >
          {event.title}
        </Text>
        {where ? (
          <Text color={onContainer} style={{ fontSize: 13 }} maxLines={1}>
            {where}
          </Text>
        ) : null}
        {progress != null ? (
          <>
            {gap(8)}
            <LinearProgressIndicator
              progress={progress}
              color={primary}
              trackColor={track}
              modifiers={[fillMaxWidth(), height(4)]}
            />
          </>
        ) : null}
      </>,
    );
  }
  function countdownCard() {
    if (!convention) return null;
    const days = dayNumber(convention.startAtMs, zone) - dayNumber(now, zone);
    // "In {count} days" splits around its number so the number can be the
    // hero; the words after it (or, in languages that put them first, before
    // it) become the unit line.
    const [before, after] = word("inDays")
      .split("{count}")
      .map((part) => part.trim());
    const unit = after || before || "";
    return card(
      <>
        {days >= 2 ? (
          <>
            <Text
              color={onContainer}
              style={{ fontSize: 36, fontWeight: "bold" }}
              maxLines={1}
            >
              {String(days)}
            </Text>
            {unit ? (
              <Text color={onContainer} style={{ fontSize: 16 }} maxLines={1}>
                {unit}
              </Text>
            ) : null}
          </>
        ) : (
          <Text
            color={onContainer}
            style={{ fontSize: 24, fontWeight: "bold" }}
            maxLines={2}
          >
            {word(days === 1 ? "tomorrow" : "today")}
          </Text>
        )}
        {gap(4)}
        <Text color={onContainer} style={{ fontSize: 13 }} maxLines={2}>
          {convention.dateRangeLabel}
        </Text>
      </>,
    );
  }
  function centred(glyph: string, title: string, hint: string) {
    return (
      <Column
        horizontalAlignment="center"
        verticalAlignment="center"
        modifiers={[fillMaxSize(), paddingAll(12)]}
      >
        <Image
          source={{ uri: glyph }}
          tint={primary}
          modifiers={[size(32, 32)]}
        />
        {gap(8)}
        <Text
          color={onSurface}
          style={{ fontSize: 16, fontWeight: "bold", textAlign: "center" }}
          maxLines={2}
        >
          {title}
        </Text>
        {hint ? (
          <>
            {gap(4)}
            <Text
              color={variant}
              style={{ fontSize: 13, textAlign: "center" }}
              maxLines={3}
            >
              {hint}
            </Text>
          </>
        ) : null}
        {stale ? (
          <>
            {gap(8)}
            {staleStrip()}
          </>
        ) : null}
      </Column>
    );
  }

  let content: ReactNode;
  if (kind === "refresh")
    content = centred(
      "widget_refresh",
      "ConPaws",
      updated ? fill(word("checkedAt"), "time", updated) : "",
    );
  else if (kind === "empty")
    content = centred(
      "widget_mark",
      word("noConvention"),
      word("noConventionHint"),
    );
  else if (kind === "noPicks")
    content = centred("widget_mark", word("noEvents"), word("noEventsHint"));
  else if (kind === "finished")
    content = centred(
      "widget_mark",
      word("finished"),
      fill(word("finishedHint"), "name", convention?.name ?? ""),
    );
  else
    content = (
      <Column modifiers={[fillMaxSize(), paddingAll(12)]}>
        {header()}
        {stale ? (
          <>
            {gap(8)}
            {staleStrip()}
          </>
        ) : null}
        {gap(10)}
        {kind === "countdown"
          ? countdownCard()
          : heroEvent
            ? eventCard(heroEvent)
            : null}
        {thenLine()}
      </Column>
    );

  // Exactly one Button, at the root: the provider opens the app only for
  // Expo's first interaction target, so any second one would be dead.
  return (
    <Button
      onClick={() => props}
      colors={{ containerColor: surface, contentColor: onSurface }}
      contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      {content}
    </Button>
  );
}

export default createWidget<ConPawsWidgetProps>(
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
