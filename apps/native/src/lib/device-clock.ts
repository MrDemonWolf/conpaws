import { getCalendars } from "expo-localization";

/**
 * The device's 12/24-hour clock preference, or undefined when the OS has no
 * opinion and the locale's own default should stand.
 *
 * Times are formatted against the in-app language rather than the device
 * region, which is deliberate for a fixed set of eight languages. The one
 * thing that choice loses is the system clock switch: an English-speaking user
 * in the UK with 24-Hour Time on had no way to reach it. Passing this into the
 * formatter gives it back without letting the region change anything else.
 *
 * Read once, like the device time zone: it only changes when the user edits a
 * system setting, and reading it per list row is not free.
 */
const usesTwentyFourHourClock = getCalendars()[0]?.uses24hourClock ?? null;

export function deviceHour12(): boolean | undefined {
  return usesTwentyFourHourClock === null
    ? undefined
    : !usesTwentyFourHourClock;
}
