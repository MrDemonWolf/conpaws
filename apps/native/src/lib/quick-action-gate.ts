/** Keep a cold shortcut parked until the root redirect has selected a tab route. */
export function canOpenQuickAction(
  navigable: boolean,
  onboardingComplete: boolean,
  firstSegment: string | undefined,
): boolean {
  return navigable && onboardingComplete && firstSegment === "(tabs)";
}
