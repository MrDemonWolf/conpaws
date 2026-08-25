import * as Haptics from "expo-haptics";

/**
 * Semantic haptics, expressed once and mapped per platform.
 *
 * Call sites name the *event* ("a toggle went on"), not a waveform, because iOS
 * and Android disagree about which waveform that should be.
 *
 * Both platforms go through the `VibrationEffect`-style API (`impactAsync` /
 * `notificationAsync`) rather than Android's `performAndroidHapticsAsync`.
 * `performAndroidHapticsAsync` calls `View.performHapticFeedback`, which a
 * device is free to drop outright, and cheap ERM ("coin") motors do exactly
 * that. Measured on the Galaxy A15 5G (`Motor type: MOTOR_COIN_DC`), every one
 * of 81 `performHapticFeedback` requests in the system vibrator history came
 * back `ignored_unsupported | played: null` -- including the ones Samsung's own
 * system UI makes -- while all 77 `VibrationEffect` vibrations played. The
 * constants buy OEM tuning and the system "Touch feedback" setting on devices
 * that honour them, but a haptic that silently never fires is worse than one
 * that ignores OEM tuning, and nothing in expo-haptics can query support up
 * front. Re-check with `adb shell dumpsys vibrator_manager` before reverting.
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

/**
 * A binary control flipped. Direction matters, so on and off deliberately feel
 * different: turning something on lands heavier than turning it off.
 */
export function hapticToggle(on: boolean) {
  run(() =>
    Haptics.impactAsync(
      on
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    ),
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
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** A light acknowledgement of a tap. iOS idiom; Android uses its ripple instead. */
export function hapticTap() {
  if (isAndroid) return;
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
