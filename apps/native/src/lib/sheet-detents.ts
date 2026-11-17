import { ROOMY_MIN } from "./content-width";

/** A peek detent never drops below this, whatever the window. */
const MIN_PEEK_FRACTION = 0.4;

/**
 * The short detent for a scrolling sheet, as a fraction of the sheet's
 * largest height.
 *
 * Phone fractions were chosen for phone heights. On an iPad the same 0.7
 * opened the event sheet roughly 840pt tall over about 500pt of content,
 * leaving a large empty band, so a wide window asks for a target height in
 * points instead.
 *
 * The base is the window height less the top safe-area inset: react-native-
 * screens resolves a fraction against the sheet's maximum detent value, which
 * is shorter than the window. Dividing by the full height opened the sheet
 * short of its target.
 *
 * Any window narrower than 600 returns `phoneFraction` exactly, so phones in
 * portrait keep the detents they have today. A phone in landscape is wider
 * than that, but its height is so small that `targetPt` exceeds it and the
 * clamp returns `phoneFraction` there too.
 */
export function peekDetent({
  width,
  height,
  topInset = 0,
  phoneFraction,
  targetPt,
}: {
  width: number;
  height: number;
  topInset?: number;
  phoneFraction: number;
  targetPt: number;
}): number {
  if (width < ROOMY_MIN) return phoneFraction;
  const available = height - Math.max(0, topInset);
  if (!(available > 0)) return phoneFraction;
  const fraction = targetPt / available;
  return Math.min(phoneFraction, Math.max(MIN_PEEK_FRACTION, fraction));
}
