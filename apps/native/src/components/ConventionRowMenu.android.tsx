import ArchiveIcon from "@expo/material-symbols/archive.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import EditIcon from "@expo/material-symbols/edit.xml";
import MoreVertIcon from "@expo/material-symbols/more_vert.xml";
import UnarchiveIcon from "@expo/material-symbols/unarchive.xml";
import { Host, Icon } from "@expo/ui";
import {
  Icon as ComposeIcon,
  Text as ComposeText,
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  RNHostView,
} from "@expo/ui/jetpack-compose";
import { useTheme } from "expo-router/react-navigation";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { PRESS_DIM } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import type {
  ConventionRowAction,
  ConventionRowActionId,
} from "@/lib/convention-row-actions";
import { themeTokens } from "@/lib/theme-tokens";

const ICONS = {
  edit: EditIcon,
  archive: ArchiveIcon,
  unarchive: UnarchiveIcon,
  delete: DeleteIcon,
};

/** Android's row menu; the iOS list renders its menu directly in SwiftUI. */
export function ConventionRowMenu({
  actions,
  accessibilityLabel,
  onAction,
}: {
  actions: readonly ConventionRowAction[];
  accessibilityLabel: string;
  onAction: (id: ConventionRowActionId) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colorScheme = useResolvedColorScheme();
  const { colors } = useTheme();
  const destructiveColor = colors.notification;
  const disabled = actions.every((action) => action.disabled);
  const trigger = (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      // The React Native trigger owns keyboard and TalkBack activation.
      onPress={() => setExpanded(true)}
      // Native rem spacing can be 42dp here; keep Material's target in dp.
      style={{ width: 48, height: 48 }}
      className={`items-center justify-center ${PRESS_DIM}`}
    >
      <Host
        colorScheme={colorScheme}
        seedColor={themeTokens[colorScheme].primary}
        matchContents
        pointerEvents="none"
      >
        <Icon name={MoreVertIcon} size={22} color={colors.text} />
      </Host>
    </Pressable>
  );

  if (disabled) return trigger;

  return (
    <View style={{ alignSelf: "center" }}>
      <Host
        colorScheme={colorScheme}
        seedColor={themeTokens[colorScheme].primary}
        matchContents
      >
        <DropdownMenu
          expanded={expanded}
          onDismissRequest={() => setExpanded(false)}
          properties={{ clippingEnabled: false }}
        >
          <DropdownMenu.Trigger>
            <RNHostView matchContents>{trigger}</RNHostView>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {actions
              .filter((action) => action.id !== "delete")
              .map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  enabled={!action.disabled}
                  onClick={() => {
                    setExpanded(false);
                    if (!action.disabled) onAction(action.id);
                  }}
                >
                  <DropdownMenuItem.Text>
                    <ComposeText>{action.label}</ComposeText>
                  </DropdownMenuItem.Text>
                  <DropdownMenuItem.LeadingIcon>
                    <ComposeIcon source={ICONS[action.id]} size={24} />
                  </DropdownMenuItem.LeadingIcon>
                </DropdownMenuItem>
              ))}
            {actions.some((action) => action.id === "delete") ? (
              <HorizontalDivider />
            ) : null}
            {actions
              .filter((action) => action.id === "delete")
              .map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  enabled={!action.disabled}
                  elementColors={{
                    textColor: destructiveColor,
                    leadingIconColor: destructiveColor,
                  }}
                  onClick={() => {
                    setExpanded(false);
                    if (!action.disabled) onAction(action.id);
                  }}
                >
                  <DropdownMenuItem.Text>
                    <ComposeText>{action.label}</ComposeText>
                  </DropdownMenuItem.Text>
                  <DropdownMenuItem.LeadingIcon>
                    <ComposeIcon source={ICONS[action.id]} size={24} />
                  </DropdownMenuItem.LeadingIcon>
                </DropdownMenuItem>
              ))}
          </DropdownMenu.Items>
        </DropdownMenu>
      </Host>
    </View>
  );
}
