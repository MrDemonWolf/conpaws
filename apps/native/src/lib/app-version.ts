/**
 * Version string assembly, kept free of native imports so it can be tested.
 *
 * The build number matters because the marketing version barely moves -- every
 * TestFlight and Play internal build of 1.0.0 looks identical without it, and a
 * bug report that says "1.0.0" cannot be tied to a build. EAS hands out the
 * build number from remote version counters, so it is the only part of this
 * that reliably increments.
 */

/**
 * Formats the version for display: `1.0.0 (42)`, or just `1.0.0` when no build
 * number is available.
 *
 * A build number is absent in Expo Go and in the web build, and
 * `expo-application` reports it as `null` there rather than throwing. Blank and
 * whitespace-only values are treated the same as absent so a misconfigured
 * build shows a clean version instead of `1.0.0 ()`.
 */
export function formatVersionLabel(
  version: string,
  build?: string | null,
): string {
  const trimmed = build?.trim();
  return trimmed ? `${version} (${trimmed})` : version;
}
