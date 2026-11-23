import { Icon } from "@expo/ui";
import type { ReactNode } from "react";
import { FieldRow } from "@/components/ui/FieldRow";
import {
  CHECK_ICON,
  RADIO_SELECTED_ICON,
  RADIO_UNSELECTED_ICON,
} from "./icons";

interface SettingsChoiceRowProps {
  /** The choice's value; with `selected` it makes the row's key. */
  id: string | number | null;
  testID: string;
  title: string;
  selected: boolean;
  /**
   * "check" marks only the chosen row. "radio" marks every row: Material uses
   * radio buttons for single-select, and iOS shows a checkmark on the chosen
   * row and a circle on the others.
   */
  indicator: "check" | "radio";
  leading?: ReactNode;
  supportingText?: string;
  onPress: () => void;
}

/**
 * One row of a pick-one Settings list (Appearance, Language, Time Format,
 * Default Reminder).
 *
 * Call it as a function, never as a component: Android's `FieldGroup.Section`
 * keeps only a bare universal `ListItem` as a flat row and wraps anything else
 * in a second card.
 *
 * The selected state is in the key on purpose. @expo/ui's Android `ListItem`
 * mounts its `trailing` slot once and then leaves it alone: it unmounts a slot
 * that becomes `undefined`, but never mounts a new one or swaps the element
 * for a different one, so the mark stayed put while the stored value changed
 * underneath it. Keying on the selection remounts only the two rows that
 * flipped, which is what makes the mark move.
 */
export function settingsChoiceRow({
  id,
  testID,
  title,
  selected,
  indicator,
  leading,
  supportingText,
  onPress,
}: SettingsChoiceRowProps) {
  return (
    <FieldRow
      key={`${id}-${selected}`}
      testID={testID}
      leading={leading}
      supportingText={supportingText}
      trailing={
        indicator === "radio" ? (
          <Icon
            name={selected ? RADIO_SELECTED_ICON : RADIO_UNSELECTED_ICON}
            size={18}
          />
        ) : selected ? (
          <Icon name={CHECK_ICON} size={18} />
        ) : undefined
      }
      onPress={onPress}
    >
      {title}
    </FieldRow>
  );
}
