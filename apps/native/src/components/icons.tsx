/**
 * `@expo/ui` icons used by more than one screen, each an SF Symbol on iOS and
 * the Material symbol with the same meaning on Android. Sizes stay at the call
 * sites.
 */

import CheckIcon from "@expo/material-symbols/check.xml";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import RadioCheckedIcon from "@expo/material-symbols/radio_button_checked.xml";
import RadioUncheckedIcon from "@expo/material-symbols/radio_button_unchecked.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";

/** A load failure in an empty state. */
export const ERROR_ICON = Icon.select({
  ios: "exclamationmark.triangle",
  android: WarningIcon,
});

/** The chosen row of a pick-one list that marks only the chosen row. */
export const CHECK_ICON = Icon.select({ ios: "checkmark", android: CheckIcon });

/**
 * The chosen and unchosen rows of a pick-one list that marks every row:
 * Material radio buttons on Android, a checkmark and a circle on iOS.
 */
export const RADIO_SELECTED_ICON = Icon.select({
  ios: "checkmark",
  android: RadioCheckedIcon,
});
export const RADIO_UNSELECTED_ICON = Icon.select({
  ios: "circle",
  android: RadioUncheckedIcon,
});

const CHEVRON_ICON = Icon.select({
  ios: "chevron.right",
  android: ChevronRightIcon,
});

/** The trailing chevron on a `FieldRow` that pushes another screen. */
export function NavigationIndicator() {
  return <Icon name={CHEVRON_ICON} size={15} />;
}
