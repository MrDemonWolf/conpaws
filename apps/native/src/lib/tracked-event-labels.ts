import type { TrackedEventLabels } from "./tracked-event.types";

type LabelKey =
  | "tracking.live.startsIn"
  | "tracking.live.endsIn"
  | "tracking.live.now"
  | "tracking.live.ended"
  | "tracking.live.stop"
  | "tracking.channel.name"
  | "tracking.channel.description";

/**
 * The Live Activity and the Android notification cannot reach i18n, so they
 * get the app's language translated here, including its regional variants.
 * The keys are written out in full so a search finds every use.
 */
export function buildTrackedEventLabels(
  translate: (key: LabelKey) => string,
): TrackedEventLabels {
  return {
    startsIn: translate("tracking.live.startsIn"),
    endsIn: translate("tracking.live.endsIn"),
    now: translate("tracking.live.now"),
    ended: translate("tracking.live.ended"),
    stop: translate("tracking.live.stop"),
    channelName: translate("tracking.channel.name"),
    channelDescription: translate("tracking.channel.description"),
  };
}
