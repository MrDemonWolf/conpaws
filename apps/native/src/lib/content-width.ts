/**
 * Width rules for wide windows: iPad (full screen, Split View, Stage Manager),
 * the unfolded iPhone Duo, Android tablets and foldables.
 *
 * Every rule reads the *window*, never the device. An iPad running ConPaws in
 * a narrow Split View pane should look like a phone, and an unfolded Duo
 * should look like a small tablet, so nothing here may ask what kind of
 * device it is (`layout-device-agnostic.test.ts` enforces that).
 *
 * Two kinds of rule:
 *
 * - **Structural choices** (the readable column, the width caps, vertical
 *   centring, sheet sizing) switch on `roomy`: both window dimensions at least
 *   600. A phone turned sideways is wider than 600 but far shorter, so it is
 *   never roomy and keeps its phone layout; the only thing that changes for it
 *   is that lists respect the horizontal safe area (the notch or Dynamic
 *   Island, or Android's side navigation bar).
 * - **Caps** sit above every phone width (the widest phone window is about
 *   480 wide, an Android phone at its smallest display size) and grow with
 *   text size through the same clamp as the readable column, so larger text
 *   gets a wider column rather than more wrapping.
 *
 * React Native has no `readableContentGuide`; 680 is a heuristic close to
 * UIKit's readable width at the default text size.
 */

/** The side margin every screen already uses: HIG's 16pt, Material's 16dp. */
export const GUTTER = 16;
/** Both window dimensions must reach this before the wide layout applies. */
export const ROOMY_MIN = 600;
/** The widest phone window in portrait, for the "phones are unchanged" rule. */
export const PHONE_MAX_WIDTH = 480;

/** Readable content column, excluding the gutters on each side. */
export const READABLE_MAX = 680;
/** Full-width buttons and action bars. */
export const ACTIONS_MAX = 448;
/** The Browse / My plan / Now segmented control. */
export const SEGMENTED_MAX = 448;
/** A centred empty state's title, body and buttons. */
export const EMPTY_STATE_MAX = 520;
/** The onboarding illustration and copy block. */
export const ONBOARDING_MAX = 560;
/** The About screen's logo block. Fixed: it sits inside a form section. */
export const ABOUT_HERO_MAX = 520;
/** Caps stop growing with text size past this scale. */
export const CAP_SCALE_MAX = 1.35;

const MEDIUM_MIN = 600;
const EXPANDED_MIN = 840;

/** Android's window size classes, by width. */
export type WidthClass = "compact" | "medium" | "expanded";

export function widthClass(width: number): WidthClass {
  if (width >= EXPANDED_MIN) return "expanded";
  if (width >= MEDIUM_MIN) return "medium";
  return "compact";
}

/**
 * Whether the window has room for the wide layout. Width alone is not
 * enough: a Pro Max in landscape is 956 wide and only 440 tall.
 */
export function isRoomy(width: number, height: number): boolean {
  return width >= ROOMY_MIN && height >= ROOMY_MIN;
}

/** Text size multiplier for caps: never below 1, never above 1.35. */
export function capScale(fontScale: number): number {
  if (!Number.isFinite(fontScale)) return 1;
  return Math.min(CAP_SCALE_MAX, Math.max(1, fontScale));
}

/** A cap scaled for the current text size. */
export function scaledCap(max: number, fontScale: number): number {
  return Math.round(max * capScale(fontScale));
}

/** A scaled cap plus the gutters a full-width block draws inside itself. */
export function outerCap(max: number, fontScale: number): number {
  return scaledCap(max, fontScale) + 2 * GUTTER;
}

export interface WindowMetrics {
  width: number;
  height: number;
  fontScale: number;
  /** Horizontal safe-area insets of the window. */
  safeLeft: number;
  safeRight: number;
}

export interface ContentWidth {
  widthClass: WidthClass;
  roomy: boolean;
  /** Width of the readable column, excluding gutters. */
  column: number;
  /**
   * Distance from the window edge to the column, ignoring the safe area.
   * `GUTTER` when the window is not roomy.
   */
  centeredInset: number;
  /** Distance from each window edge to content, safe area included. */
  left: number;
  right: number;
  /**
   * Content padding for a full-window React Native list whose rows keep
   * their own `px-4` gutter. Symmetric on purpose: Android can lay the app out
   * right to left on an RTL device even though no RTL locale ships, and React
   * Native swaps physical left and right padding there, which would put a
   * one-sided safe-area inset on the wrong edge.
   */
  listPadding: { paddingHorizontal: number };
  /**
   * SwiftUI List row insets, per physical side. SwiftUI already keeps rows
   * out of the horizontal safe area, so each side leaves out its own safe
   * area. The row edges then land on `left` and `right`, so a one-sided safe
   * area still leaves the column centred.
   */
  rowInset: { left: number; right: number };
  /**
   * iOS horizontal padding for a full-window SwiftUI Form, or null to keep
   * the system margin (not roomy, or the column is no narrower than the
   * default margins would make it).
   */
  formSectionMargin: number | null;
  /**
   * Extra symmetric padding for a full-window Android FieldGroup, on top of
   * its own 16dp content padding. Zero when not roomy.
   */
  formGutter: number;
}

/** The readable column and the insets that centre it, for one window. */
export function contentWidth(metrics: WindowMetrics): ContentWidth {
  const { width, height, fontScale } = metrics;
  const safeLeft = Math.max(0, metrics.safeLeft);
  const safeRight = Math.max(0, metrics.safeRight);
  const roomy = isRoomy(width, height);
  const usable = Math.max(0, width - 2 * GUTTER);
  const column = roomy
    ? Math.min(scaledCap(READABLE_MAX, fontScale), usable)
    : usable;
  const centeredInset = roomy ? (width - column) / 2 : GUTTER;
  const left = Math.max(safeLeft + GUTTER, centeredInset);
  const right = Math.max(safeRight + GUTTER, centeredInset);
  // `centeredInset` is GUTTER when not roomy, so phones keep 16 on each side.
  const rowInset = {
    left: Math.max(GUTTER, centeredInset - safeLeft),
    right: Math.max(GUTTER, centeredInset - safeRight),
  };

  return {
    widthClass: widthClass(width),
    roomy,
    column,
    centeredInset,
    left,
    right,
    listPadding: { paddingHorizontal: Math.max(left, right) - GUTTER },
    rowInset,
    formSectionMargin: roomy && centeredInset > 20 ? centeredInset : null,
    formGutter: roomy ? centeredInset - GUTTER : 0,
  };
}

/**
 * The `maxWidth` for a block capped at `max`, or undefined when the window is
 * not roomy. A cap follows its container, so it also behaves inside a sheet.
 * `gutter` adds the side gutters for a block that draws its own `px-4`.
 */
export function capWidth(
  max: number,
  metrics: Pick<WindowMetrics, "width" | "height" | "fontScale">,
  { gutter = true }: { gutter?: boolean } = {},
): number | undefined {
  if (!isRoomy(metrics.width, metrics.height)) return undefined;
  return gutter
    ? outerCap(max, metrics.fontScale)
    : scaledCap(max, metrics.fontScale);
}
