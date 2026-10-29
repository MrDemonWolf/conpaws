import ArchiveIcon from "@expo/material-symbols/archive.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import EditIcon from "@expo/material-symbols/edit.xml";
import MoreVertIcon from "@expo/material-symbols/more_vert.xml";
import UnarchiveIcon from "@expo/material-symbols/unarchive.xml";
import { Host, Icon } from "@expo/ui";
import { type MenuComponentRef, MenuView } from "@expo/ui/community/menu";
import { useTheme } from "expo-router/react-navigation";
import { useRef } from "react";
import { Pressable } from "react-native";
import { PRESS_DIM } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import type {
  ConventionRowAction,
  ConventionRowActionId,
} from "@/lib/convention-row-actions";

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
  const menu = useRef<MenuComponentRef>(null);
  const colorScheme = useResolvedColorScheme();
  const { colors } = useTheme();
  const disabled = actions.every((action) => action.disabled);
  const nativeActions = actions.map((action) => ({
    id: action.id,
    title: action.label,
    image: ICONS[action.id],
    attributes: {
      destructive: action.id === "delete",
      disabled: action.disabled,
    },
  }));
  const trigger = (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      // MenuView's wrapper is not focusable; this owns keyboard and TalkBack activation.
      onPress={() => menu.current?.show()}
      className={`h-12 w-12 items-center justify-center ${PRESS_DIM}`}
    >
      <Host colorScheme={colorScheme} matchContents pointerEvents="none">
        <Icon name={MoreVertIcon} size={22} color={colors.text} />
      </Host>
    </Pressable>
  );

  if (disabled) return trigger;

  return (
    <MenuView
      ref={menu}
      colorScheme={colorScheme}
      style={{ alignSelf: "center" }}
      actions={[
        ...nativeActions.filter((action) => action.id !== "delete"),
        {
          id: "destructive",
          title: "",
          displayInline: true,
          subactions: nativeActions.filter((action) => action.id === "delete"),
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        const action = actions.find((item) => item.id === nativeEvent.event);
        if (action && !action.disabled) onAction(action.id);
      }}
    >
      {trigger}
    </MenuView>
  );
}
