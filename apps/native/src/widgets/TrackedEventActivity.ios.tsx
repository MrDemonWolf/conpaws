import {
  Button,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  layoutPriority,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  progressViewStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import {
  createLiveActivity,
  type LiveActivityEnvironment,
  type LiveActivityLayout,
} from "expo-widgets";
import {
  TRACKED_EVENT_ACTIVITY_NAME,
  type TrackedEventProps,
} from "@/lib/tracked-event.types";

export function TrackedEventActivityLayout(
  props: TrackedEventProps,
  environment: LiveActivityEnvironment,
): LiveActivityLayout {
  "widget";

  // The layout runs in an isolated runtime with no app imports, so every value
  // it needs comes from the JSON props. The environment carries no clock: the
  // phase is worked out from the render time, and the app sets the stale date
  // to the next boundary so the system renders again when the phase changes.
  const now = Date.now();
  const valid =
    Number.isFinite(props.startAtMs) && Number.isFinite(props.cleanupAtMs);
  const hasEnd =
    valid &&
    typeof props.endAtMs === "number" &&
    Number.isFinite(props.endAtMs) &&
    props.endAtMs > props.startAtMs;
  const endAtMs = hasEnd ? (props.endAtMs as number) : null;
  const finishAtMs = endAtMs ?? props.cleanupAtMs;
  // A stale activity past its cleanup time is over even if the app never got
  // the chance to end it.
  const phase =
    !valid ||
    now >= finishAtMs ||
    (environment.isStale === true && now >= props.cleanupAtMs)
      ? "ended"
      : now < props.startAtMs
        ? "upcoming"
        : endAtMs != null
          ? "running"
          : "open";
  // A countdown only ever targets the start or the real end. Native drops a
  // timer whose lower bound is after its upper bound, so lower is clamped.
  const countdownTarget =
    phase === "upcoming"
      ? props.startAtMs
      : phase === "running" && endAtMs != null
        ? endAtMs
        : null;
  const caption =
    phase === "upcoming"
      ? props.labels.startsIn
      : phase === "running"
        ? props.labels.endsIn
        : phase === "open"
          ? props.labels.now
          : props.labels.ended;
  const ended = phase === "ended";
  // The Lock Screen banner and the Dynamic Island are dark surfaces in both
  // appearances, where the light-mode brand blue is too dim to read, so they
  // always take the bright accent.
  const accent = "#18B7F2";
  const primary = foregroundStyle({ type: "hierarchical", style: "primary" });
  const secondary = foregroundStyle({
    type: "hierarchical",
    style: "secondary",
  });
  const symbol = "calendar.badge.clock";

  function countdown(textStyle: "title3" | "caption" | "footnote") {
    if (countdownTarget == null) return null;
    return (
      <Text
        timerInterval={{
          lower: new Date(Math.min(now, countdownTarget)),
          upper: new Date(countdownTarget),
        }}
        countsDown
        modifiers={[
          font({ textStyle, weight: "semibold" }),
          monospacedDigit(),
          foregroundStyle(accent),
          lineLimit(1),
          multilineTextAlignment("trailing"),
          layoutPriority(2),
        ]}
      />
    );
  }
  // Without a countdown the caption itself is the status: "Now" for an event
  // with no end time, "Ended" once it is over. Neither invents an end.
  function status(textStyle: "title3" | "caption" | "footnote") {
    return (
      <Text
        modifiers={[
          font({ textStyle, weight: ended ? "regular" : "semibold" }),
          ended ? secondary : foregroundStyle(accent),
          lineLimit(1),
        ]}
      >
        {caption}
      </Text>
    );
  }
  function phaseBlock(alignment: "leading" | "trailing") {
    if (countdownTarget == null) return status("title3");
    return (
      <VStack alignment={alignment} spacing={1}>
        <Text
          modifiers={[font({ textStyle: "caption" }), secondary, lineLimit(1)]}
        >
          {caption}
        </Text>
        {countdown("title3")}
      </VStack>
    );
  }
  function progress() {
    if (phase !== "running" || endAtMs == null) return null;
    // The countdown text already speaks the time left, so the bar is visual only.
    return (
      <ProgressView
        timerInterval={{
          lower: new Date(props.startAtMs),
          upper: new Date(endAtMs),
        }}
        countsDown={false}
        modifiers={[
          progressViewStyle("linear"),
          labelsHidden(),
          tint(accent),
          accessibilityHidden(true),
        ]}
      />
    );
  }
  function title(lines: number, textStyle: "headline" | "subheadline") {
    return (
      <Text
        modifiers={[
          font({ textStyle, weight: "semibold" }),
          ended ? secondary : primary,
          lineLimit(lines),
          layoutPriority(1),
        ]}
      >
        {props.title}
      </Text>
    );
  }
  // Time and place each get their own line, so a long room name can never
  // push the time off screen or be cut short by it.
  function detailsLines() {
    return (
      <VStack alignment="leading" spacing={1}>
        {props.timeLabel ? (
          <Text
            modifiers={[
              font({ textStyle: "subheadline" }),
              secondary,
              monospacedDigit(),
              lineLimit(1),
            ]}
          >
            {props.timeLabel}
          </Text>
        ) : null}
        {props.place ? (
          <Text
            modifiers={[
              font({ textStyle: "subheadline" }),
              secondary,
              lineLimit(1),
            ]}
          >
            {props.place}
          </Text>
        ) : null}
      </VStack>
    );
  }
  function stopButton() {
    return (
      <Button
        target="conpaws-tracked-event-stop"
        label={props.labels.stop}
        systemImage="stop.circle"
        modifiers={[
          buttonStyle("bordered"),
          controlSize("small"),
          tint(accent),
          accessibilityLabel(`${props.labels.stop}, ${props.title}`),
        ]}
      />
    );
  }
  // Where the title is not on screen, the symbol is the only thing VoiceOver
  // can reach, so it names the event; elsewhere it is decoration.
  function icon(textStyle: "title3" | "caption" | "footnote", spoken: boolean) {
    return (
      <Image
        systemName={symbol}
        modifiers={[
          font({ textStyle }),
          foregroundStyle(accent),
          spoken
            ? accessibilityLabel(`${props.title}, ${caption}`)
            : accessibilityHidden(true),
        ]}
      />
    );
  }

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[padding({ all: 16 })]}
      >
        <HStack spacing={6}>
          {icon("footnote", false)}
          <Text
            modifiers={[
              font({ textStyle: "caption", weight: "semibold" }),
              secondary,
              lineLimit(1),
            ]}
          >
            {props.conventionName}
          </Text>
          <Spacer />
        </HStack>
        <HStack alignment="top" spacing={12}>
          <VStack alignment="leading" spacing={2}>
            {title(2, "headline")}
            {detailsLines()}
          </VStack>
          <Spacer minLength={8} />
          {phaseBlock("trailing")}
        </HStack>
        {progress()}
        <HStack>
          <Spacer />
          {stopButton()}
        </HStack>
      </VStack>
    ),
    bannerSmall: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 8 })]}>
        {title(2, "subheadline")}
        {countdownTarget == null ? status("footnote") : countdown("footnote")}
      </VStack>
    ),
    compactLeading: icon("footnote", true),
    compactTrailing:
      countdownTarget == null ? (
        <Text
          modifiers={[
            font({ textStyle: "caption", weight: "semibold" }),
            ended ? secondary : foregroundStyle(accent),
            lineLimit(1),
            frame({ maxWidth: 64 }),
          ]}
        >
          {caption}
        </Text>
      ) : (
        <Text
          timerInterval={{
            lower: new Date(Math.min(now, countdownTarget)),
            upper: new Date(countdownTarget),
          }}
          countsDown
          modifiers={[
            font({ textStyle: "caption", weight: "semibold" }),
            monospacedDigit(),
            foregroundStyle(accent),
            lineLimit(1),
            multilineTextAlignment("trailing"),
            // A timer text sizes itself for its widest value; capping it keeps
            // the compact island from stretching across the screen.
            frame({ maxWidth: 64 }),
          ]}
        />
      ),
    minimal: icon("caption", true),
    expandedLeading: icon("title3", false),
    expandedCenter: title(1, "headline"),
    expandedTrailing: phaseBlock("trailing"),
    expandedBottom: (
      <VStack alignment="leading" spacing={6}>
        {progress()}
        <HStack alignment="bottom" spacing={8}>
          {detailsLines()}
          <Spacer minLength={4} />
          {stopButton()}
        </HStack>
      </VStack>
    ),
  };
}

export default createLiveActivity<TrackedEventProps>(
  TRACKED_EVENT_ACTIVITY_NAME,
  TrackedEventActivityLayout,
);
