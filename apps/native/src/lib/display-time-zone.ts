import { getCalendars } from "expo-localization";
import { isValidTimeZone } from "./convention-time";

/** The device's IANA zone, or UTC when the OS reports none. */
export function getDeviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? "UTC";
}

/**
 * The zone a convention's times are shown in: its own when that is a zone
 * this device knows, otherwise the device's.
 */
export function displayTimeZone(stored: string | null | undefined): string {
  return isValidTimeZone(stored) ? stored : getDeviceTimeZone();
}
