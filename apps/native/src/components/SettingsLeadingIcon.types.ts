/**
 * The leading glyph on a Settings row, named by what the row does rather than
 * by which glyph draws it -- the two platforms draw these from different icon
 * sets, and a shared call site cannot name both.
 */
export type SettingsIconName =
  | "theme"
  | "language"
  | "notifications"
  | "export"
  | "import"
  | "about"
  | "help"
  | "privacy"
  | "terms"
  | "debug";

export interface SettingsLeadingIconProps {
  name: SettingsIconName;
}
