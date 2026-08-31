import BugIcon from "@expo/material-symbols/bug_report.xml";
import DescriptionIcon from "@expo/material-symbols/description.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import PrivacyIcon from "@expo/material-symbols/front_hand.xml";
import HelpIcon from "@expo/material-symbols/help.xml";
import InfoIcon from "@expo/material-symbols/info.xml";
import LanguageIcon from "@expo/material-symbols/language.xml";
import NotificationsIcon from "@expo/material-symbols/notifications.xml";
import PaletteIcon from "@expo/material-symbols/palette.xml";
import ShareIcon from "@expo/material-symbols/share.xml";
import { Icon } from "@expo/ui";

import type {
  SettingsIconName,
  SettingsLeadingIconProps,
} from "./SettingsLeadingIcon.types";

/**
 * Compose-native icons, because a React Native view here **crashes the app**.
 *
 * Settings used to render lucide glyphs on both platforms. A lucide icon is a
 * React Native view, and putting one in an `@expo/ui` ListItem `leading` slot
 * makes Compose host it through `AndroidView` interop -- which throws
 * `IllegalStateException: The specified child already has a parent` from
 * `AndroidViewHolder.<init>` when the row recomposes. Reproducible on the
 * emulator as Conventions -> Schedule -> Settings, and fatal: the whole
 * Settings tab was unreachable on Android.
 *
 * `RNHostView` is not the way out. The About screen already documents that it
 * renders nothing inside an @expo/ui list on Android -- with `matchContents`
 * it measures to zero and the content silently vanishes. About solves the same
 * problem the same way this does, with a native Icon.
 *
 * The stale comment on the old shared `LeadingIcon` said native Icons
 * "collapse inside RN wrapper views". True of an RN wrapper; a ListItem slot
 * is not one, and About has shipped native Icons in `leading` all along.
 */
const GLYPHS: Record<SettingsIconName, Parameters<typeof Icon>[0]["name"]> = {
  theme: PaletteIcon,
  language: LanguageIcon,
  notifications: NotificationsIcon,
  export: ShareIcon,
  import: DownloadIcon,
  about: InfoIcon,
  help: HelpIcon,
  privacy: PrivacyIcon,
  terms: DescriptionIcon,
  debug: BugIcon,
};

export function SettingsLeadingIcon({ name }: SettingsLeadingIconProps) {
  // No colour prop: a ListItem slot supplies Compose's content colour, which
  // is why these follow the theme while a bare Host's Icon does not.
  return <Icon name={GLYPHS[name]} size={21} />;
}
