import * as Haptics from "expo-haptics";

/**
 * Semantic haptics, expressed once and mapped per platform.
 *
 * Call sites name the *event* ("a toggle went on"), not a waveform, because iOS
 * and Android disagree about which waveform that should be. On Android these
 * route through `performAndroidHapticsAsync`, whose constants map onto the
 * platform's own `HapticFeedbackConstants` -- so they respect OEM haptic tuning
 * and the user's system "Touch feedback" setting, which raw `impactAsync`
 * amplitude patterns do not.
 *
 * Every helper is fire-and-forget and swallows its own errors: a device with no
 * vibrator, or one that refuses the effect, must never fail the action that
 * triggered it.
 */

let enabled = true;

/** Mirrors the user's Settings toggle. Off means no helper does anything. */
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function getHapticsEnabled(): boolean {
  return enabled;
}

function run(effect: () => Promise<void>) {
  if (!enabled) return;
  effect().catch(() => undefined);
}

const isAndroid = process.env.EXPO_OS === "android";

/** A change the user committed and that was written successfully. */
export function hapticSuccess() {
  run(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

/**
 * A binary control flipped. Direction matters: Android's toggle constants are
 * asymmetric by design, so on and off deliberately feel different.
 */
export function hapticToggle(on: boolean) {
  run(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(
          on
            ? Haptics.AndroidHaptics.Toggle_On
            : Haptics.AndroidHaptics.Toggle_Off,
        )
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );
}

/**
 * A long press that opened something.
 *
 * There is deliberately no plain-tap helper. Material 3 does not give ordinary
 * list-item presses haptic feedback -- Android expresses that through the
 * ripple -- so tap feedback stays iOS-only at its call site.
 */
export function hapticLongPress() {
  run(() =>
    isAndroid
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );
}

/** A light acknowledgement of a tap. iOS idiom; Android uses its ripple instead. */
export function hapticTap() {
  if (isAndroid) return;
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
