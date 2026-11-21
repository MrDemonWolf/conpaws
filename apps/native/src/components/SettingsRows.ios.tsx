import { HStack, Image, Text, Toggle } from "@expo/ui/swift-ui";
import { font, foregroundStyle, lineLimit } from "@expo/ui/swift-ui/modifiers";

import { useWindowDimensions } from "react-native";

import { FieldRow } from "@/components/ui/FieldRow";
import { RowSpinner } from "@/components/ui/RowSpinner";

import { SettingsLeadingIcon } from "./SettingsLeadingIcon.ios";
import {
  SETTINGS_STACKED_FONT_SCALE,
  type SettingsLinkRowProps,
  type SettingsSwitchRowProps,
} from "./SettingsRows.types";

// Hierarchical styles, not named label colours: Expo's colour converter does
// not know "secondaryLabel", so a style using it is dropped and the text draws
// in the primary colour. That is also why the subtitle is passed as a styled
// Text: `ListItem` styles a plain-string `supportingText` with that name
// (@expo/ui 58.0.29).
const SECONDARY = foregroundStyle({ type: "hierarchical", style: "secondary" });
const TERTIARY = foregroundStyle({ type: "hierarchical", style: "tertiary" });
const SUBTITLE = font({ textStyle: "subheadline" });

/** The grey value and chevron iOS Settings puts on the trailing side. */
function Trailing({
  value,
  kind,
}: Pick<SettingsLinkRowProps, "value" | "kind">) {
  return (
    <HStack spacing={6}>
      {value ? (
        <Text modifiers={[SECONDARY, lineLimit(1)]}>{value}</Text>
      ) : null}
      {kind === "action" ? null : (
        <Image
          systemName={kind === "external" ? "arrow.up.right" : "chevron.right"}
          size={13}
          modifiers={[TERTIARY]}
        />
      )}
    </HStack>
  );
}

function SettingsLinkRowView({
  icon,
  title,
  value,
  description,
  kind = "navigate",
  busy = false,
  onPress,
  testID,
}: SettingsLinkRowProps) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= SETTINGS_STACKED_FONT_SCALE;
  const subtitle = stacked ? (value ?? description) : description;
  return (
    <FieldRow
      testID={testID}
      leading={<SettingsLeadingIcon name={icon} />}
      supportingText={
        subtitle ? (
          <Text modifiers={[SUBTITLE, SECONDARY]}>{subtitle}</Text>
        ) : undefined
      }
      trailing={
        busy ? (
          <RowSpinner />
        ) : (
          <Trailing value={stacked ? undefined : value} kind={kind} />
        )
      }
      onPress={busy ? undefined : onPress}
    >
      {title}
    </FieldRow>
  );
}

/**
 * A native SwiftUI Toggle whose label carries the row's icon tile, so the
 * title lines up with the link rows and the whole row stays one control for
 * VoiceOver.
 */
function SettingsSwitchRowView({
  icon,
  title,
  value,
  onValueChange,
  testID,
}: SettingsSwitchRowProps) {
  return (
    <Toggle isOn={value} onIsOnChange={onValueChange} testID={testID}>
      <HStack spacing={12}>
        <SettingsLeadingIcon name={icon} />
        <Text>{title}</Text>
      </HStack>
    </Toggle>
  );
}

// Functions, to match Android, where a section needs the row element itself
// (see SettingsRows.android.tsx). A SwiftUI Form takes any view, so iOS keeps
// the components, and their hooks, behind them.
export function settingsLinkRow(props: SettingsLinkRowProps) {
  return <SettingsLinkRowView {...props} />;
}

export function settingsSwitchRow(props: SettingsSwitchRowProps) {
  return <SettingsSwitchRowView {...props} />;
}
