import AlarmIcon from "@expo/material-symbols/alarm.xml";
import BugIcon from "@expo/material-symbols/bug_report.xml";
import DescriptionIcon from "@expo/material-symbols/description.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import PrivacyIcon from "@expo/material-symbols/front_hand.xml";
import HelpIcon from "@expo/material-symbols/help.xml";
import InfoIcon from "@expo/material-symbols/info.xml";
import LanguageIcon from "@expo/material-symbols/language.xml";
import VibrateIcon from "@expo/material-symbols/mobile_vibrate.xml";
import NotificationsIcon from "@expo/material-symbols/notifications.xml";
import PaletteIcon from "@expo/material-symbols/palette.xml";
import ScheduleIcon from "@expo/material-symbols/schedule.xml";
import ScienceIcon from "@expo/material-symbols/science.xml";
import SyncIcon from "@expo/material-symbols/sync.xml";
import UploadIcon from "@expo/material-symbols/upload.xml";
import { Icon } from "@expo/ui";
import { useWindowDimensions } from "react-native";

import type {
  SettingsIconName,
  SettingsLeadingIconProps,
} from "./SettingsLeadingIcon.types";

/**
 * Compose-native icons, because a React Native view here **crashes the app**.
 *
 * A React Native view in an `@expo/ui` ListItem `leading` slot makes Compose
 * host it through `AndroidView` interop, which throws
 * `IllegalStateException: The specified child already has a parent` from
 * `AndroidViewHolder.<init>` when the row recomposes. That is fatal: the
 * whole Settings tab becomes unreachable on Android.
 *
 * `RNHostView` is not the way out. The About screen already documents that it
 * renders nothing inside an @expo/ui list on Android -- with `matchContents`
 * it measures to zero and the content silently vanishes. About solves the same
 * problem the same way this does, with a native Icon.
 */
const GLYPHS: Record<SettingsIconName, Parameters<typeof Icon>[0]["name"]> = {
  theme: PaletteIcon,
  haptics: VibrateIcon,
  language: LanguageIcon,
  time: ScheduleIcon,
  notifications: NotificationsIcon,
  reminder: AlarmIcon,
  updates: SyncIcon,
  export: UploadIcon,
  import: DownloadIcon,
  help: HelpIcon,
  about: InfoIcon,
  privacy: PrivacyIcon,
  terms: DescriptionIcon,
  preview: ScienceIcon,
  debug: BugIcon,
};

export function SettingsLeadingIcon({ name }: SettingsLeadingIconProps) {
  const { fontScale } = useWindowDimensions();
  // No colour prop: a ListItem slot supplies Compose's content colour, which
  // is why these follow the theme while a bare Host's Icon does not.
  return <Icon name={GLYPHS[name]} size={21 * fontScale} />;
}
