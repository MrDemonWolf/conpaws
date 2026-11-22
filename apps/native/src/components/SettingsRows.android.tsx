import ArrowOutwardIcon from "@expo/material-symbols/arrow_outward.xml";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import { Icon, Switch } from "@expo/ui";

import { FieldRow } from "@/components/ui/FieldRow";
import { RowSpinner } from "@/components/ui/RowSpinner";

import { SettingsLeadingIcon } from "./SettingsLeadingIcon.android";
import type {
  SettingsLinkRowProps,
  SettingsSwitchRowProps,
} from "./SettingsRows.types";

function Trailing({ kind }: Pick<SettingsLinkRowProps, "kind">) {
  if (kind === "action") return null;
  return (
    <Icon
      name={kind === "external" ? ArrowOutwardIcon : ChevronRightIcon}
      size={kind === "external" ? 15 : 16}
    />
  );
}

/**
 * Material settings rows put the current value under the title as supporting
 * text, so `value` and `description` share that line here.
 *
 * Call it as a function, not as `<SettingsLinkRow />`: it must hand
 * `FieldGroup.Section` the `FieldRow` element itself. The section draws a
 * universal `ListItem` as its row, but wraps any other element type, a
 * component that renders a `ListItem` included, in a second Compose
 * `ListItem`, which drew every row as a card inside the section's card.
 */
export function settingsLinkRow({
  icon,
  title,
  value,
  description,
  kind = "navigate",
  busy = false,
  onPress,
  testID,
}: SettingsLinkRowProps) {
  return (
    <FieldRow
      testID={testID}
      leading={<SettingsLeadingIcon name={icon} />}
      supportingText={value ?? description}
      trailing={busy ? <RowSpinner /> : <Trailing kind={kind} />}
      onPress={busy ? undefined : onPress}
    >
      {title}
    </FieldRow>
  );
}

/**
 * The icon and title in the row, the switch on the trailing side, and the
 * whole row toggles it -- Material's settings switch row. A function for the
 * same reason as `settingsLinkRow`.
 */
export function settingsSwitchRow({
  icon,
  title,
  value,
  onValueChange,
  testID,
}: SettingsSwitchRowProps) {
  return (
    <FieldRow
      testID={testID}
      leading={<SettingsLeadingIcon name={icon} />}
      trailing={<Switch value={value} onValueChange={onValueChange} />}
      onPress={() => onValueChange(!value)}
    >
      {title}
    </FieldRow>
  );
}
