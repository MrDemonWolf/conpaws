import type { SettingsIconName } from "./SettingsLeadingIcon.types";

/**
 * The Dynamic Type scale at which a row stops sharing its line: from the first
 * accessibility size, a trailing value would break the title mid-word, so iOS
 * moves it under the title, as iOS Settings does. Event rows stack at the same
 * point.
 */
export const SETTINGS_STACKED_FONT_SCALE = 1.6;

/**
 * A Settings row that opens something: another screen ("navigate"), a web
 * page or system settings ("external"), or nothing beyond its own action.
 *
 * iOS shows `value` on the trailing side next to the chevron, as iOS Settings
 * does, and under the title at accessibility text sizes; Android always shows
 * it as Material supporting text under the title.
 */
export interface SettingsLinkRowProps {
  icon: SettingsIconName;
  title: string;
  /** The current choice, e.g. "System" or "English". */
  value?: string;
  /**
   * A short explanation under the title, for rows without a value. A row
   * shows one line under its title, so `value` wins where both would.
   */
  description?: string;
  kind?: "navigate" | "external" | "action";
  /** Shows a spinner instead of the chevron and ignores presses. */
  busy?: boolean;
  onPress?: () => void;
}

/** A Settings row whose whole job is one on/off choice. */
export interface SettingsSwitchRowProps {
  icon: SettingsIconName;
  title: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  testID?: string;
}
