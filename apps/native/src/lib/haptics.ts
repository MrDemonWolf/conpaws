/**
 * Pure haptics-preference encoding, kept free of native imports so it stays
 * testable -- the same split as `appearance.ts` versus `appearance-storage.ts`.
 */

/** Anything other than an explicit opt-out means on, including a missing key. */
export function parseHapticsPreference(value: string | null): boolean {
  return value !== "off";
}

export function serializeHapticsPreference(enabled: boolean): string {
  return enabled ? "on" : "off";
}
