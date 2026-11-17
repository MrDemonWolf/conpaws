import { Button, Column, Text } from "@expo/ui/jetpack-compose";
import {
  cornerRadius,
  fillMaxSize,
  paddingAll,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ConPawsWidgetProps } from "./ConPawsWidget.types";

/** Self-contained because Expo evaluates this function in its isolated widget runtime. */
export function ConPawsWidgetLayout(
  props: ConPawsWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";
  const snapshot = props.snapshot;
  const now = Date.now();
  const conventions =
    [1, 2].includes(snapshot?.schemaVersion) &&
    Array.isArray(snapshot?.conventions)
      ? snapshot.conventions
      : [];
  const endOf = (event: (typeof conventions)[number]["events"][number]) =>
    event.endAtMs ?? event.startAtMs + 3_600_000;
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
  const event = current ?? events.find((event) => event.startAtMs > now);
  const presentation = snapshot?.presentation;
  const dark =
    presentation?.appearance === "dark" ||
    (presentation?.appearance !== "light" &&
      environment.colorScheme === "dark");
  const palette =
    presentation?.palette[dark ? "dark" : "light"] ??
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
  const labels = presentation?.labels;
  const state = event ? (current ? labels?.current : labels?.next) : undefined;
  const title =
    event?.title ??
    (convention?.events.length ? labels?.finished : labels?.noEvents) ??
    "ConPaws";
  const zone = convention?.timeZoneIdentifier ?? "UTC";
  const locale = snapshot?.localeIdentifier || "en";
  const hour12 =
    snapshot?.timeFormat === "12"
      ? true
      : snapshot?.timeFormat === "24"
        ? false
        : presentation?.hour12;
  const clock = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
  const endDay = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    month: "numeric",
    day: "numeric",
  });
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = (instant: number) => clock.format(new Date(instant));
  let range = "";
  if (event) {
    const startDay = day.format(new Date(event.startAtMs));
    const sameDay =
      event.endAtMs !== null &&
      dateKey.format(new Date(event.startAtMs)) ===
        dateKey.format(new Date(event.endAtMs));
    const endLabel =
      event.endAtMs === null
        ? ""
        : `${sameDay ? "" : `${endDay.format(new Date(event.endAtMs))} `}${time(event.endAtMs)}`;
    const prefix =
      dateKey.format(new Date(event.startAtMs)) ===
      dateKey.format(new Date(now))
        ? ""
        : `${startDay} · `;
    range = `${prefix}${time(event.startAtMs)}${endLabel ? ` – ${endLabel}` : ""}`;
  }
  const room = event?.room?.trim() || event?.location?.trim();
  return (
    <Button
      onClick={() => props}
      colors={{
        containerColor: palette.background,
        contentColor: palette.foreground,
      }}
      contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }}
      modifiers={[fillMaxSize(), cornerRadius(20)]}
    >
      <Column
        modifiers={[fillMaxSize(), paddingAll(10)]}
        verticalArrangement={{ spacedBy: 2 }}
      >
        <Text
          color={palette.accent}
          style={{ fontSize: 12, fontWeight: "bold" }}
          maxLines={1}
        >
          {[state, convention?.name].filter(Boolean).join(" · ") || "ConPaws"}
        </Text>
        <Text
          color={palette.foreground}
          style={{ fontSize: 17, fontWeight: "bold" }}
          maxLines={1}
        >
          {title}
        </Text>
        {range ? (
          <Text
            color={palette.foreground}
            style={{ fontSize: 12 }}
            maxLines={3}
          >
            {range}
          </Text>
        ) : null}
        {room ? (
          <Text color={palette.secondary} style={{ fontSize: 12 }} maxLines={1}>
            {room}
          </Text>
        ) : null}
      </Column>
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
