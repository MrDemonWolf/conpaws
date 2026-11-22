/**
 * The leading glyph on a Settings row, named by what the row does rather than
 * by which glyph draws it -- the two platforms draw these from different icon
 * sets, and a shared call site cannot name both.
 *
 * Every row has one, so row titles line up down the whole screen.
 */
export type SettingsIconName =
  | "theme"
  | "haptics"
  | "language"
  | "time"
  | "notifications"
  | "reminder"
  | "updates"
  | "export"
  | "import"
  | "help"
  | "about"
  | "privacy"
  | "terms"
  | "preview"
  | "debug";

export interface SettingsLeadingIconProps {
  name: SettingsIconName;
}
