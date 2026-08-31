import RadioCheckedIcon from "@expo/material-symbols/radio_button_checked.xml";
import RadioUncheckedIcon from "@expo/material-symbols/radio_button_unchecked.xml";
import { FieldGroup, Host, Icon } from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// See components/ui/FieldRow.android.tsx — one Material surface per row.
import { FieldRow as ListItem } from "@/components/ui/FieldRow";

import { NativeText } from "@/components/ui/NativeText";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { reminderDefaultLabel } from "@/lib/reminder-default-label";
import {
  getCachedDefaultReminderMinutes,
  getDefaultReminderMinutes,
  REMINDER_DEFAULT_OPTIONS,
  setDefaultReminderMinutes,
} from "@/lib/reminder-default-storage";

/**
 * Both states draw an icon, and that is load-bearing rather than decorative.
 *
 * @expo/ui's Android ListItem will *unmount* a slot whose prop goes from an
 * element to `undefined`, but it never *mounts* one that goes the other way.
 * So a checkmark rendered only when selected vanishes off the old row on the
 * first tap and never appears on the new one -- the list ends up with nothing
 * marked, while the value underneath is stored correctly. Keeping the slot
 * filled in both states means the prop only ever changes element-to-element,
 * which does update.
 *
 * Radio buttons rather than a checkmark because that is what Material uses for
 * single-select, and because an always-present empty checkmark would be odd.
 * iOS keeps its checkmark: SwiftUI mounts the slot either way, and a bare
 * check is the platform idiom there.
 */
const SELECTED_ICON = Icon.select({
  ios: "checkmark",
  android: RadioCheckedIcon,
});
const UNSELECTED_ICON = Icon.select({
  ios: "circle",
  android: RadioUncheckedIcon,
});

/** "No default" first, then the lead times in order. */
const CHOICES: Array<number | null> = [null, ...REMINDER_DEFAULT_OPTIONS];

/**
 * Picks the lead time new leave reminders start from.
 *
 * Android reaches this from a Settings row. It used to be an `@expo/ui`
 * `<Picker>` inline in Settings, which on Android renders a Material 3
 * `ExposedDropdownMenuBox` whose anchor is a bare `TextField` -- unlabelled,
 * sized to its own content rather than the row, and trailing an underline past
 * its own edge. The universal Picker exposes no `style` and no `label`, so
 * there was nothing to set. Theme and Language already answer the same
 * question with a pushed list of rows, and Material selects from a list this
 * way regardless, so this follows them.
 *
 * iOS keeps the compact SwiftUI menu in the Settings row's trailing slot and
 * never pushes here.
 */
export default function ReminderDefaultScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();
  const [selected, setSelected] = useState<number | null>(
    getCachedDefaultReminderMinutes,
  );

  // The cache is empty on a cold open straight to this screen.
  useEffect(() => {
    void getDefaultReminderMinutes().then(setSelected);
  }, []);

  function handleSelect(next: number | null) {
    if (next === selected) return;
    setSelected(next);
    // `setDefaultReminderMinutes` writes the cache first and swallows storage
    // failures, so there is no rejection to handle and nothing to roll back.
    void setDefaultReminderMinutes(next);
  }

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section>
          {CHOICES.map((minutes) => {
            const isSelected = minutes === selected;

            return (
              <ListItem
                // Selected state is in the key on purpose. @expo/ui's Android
                // ListItem mounts its `trailing` slot once and then leaves it
                // alone -- it will unmount a slot that goes to `undefined`, but
                // it never mounts a new one and never swaps the element for a
                // different one, so the radio simply never moved while the
                // stored value changed underneath it. Keying on `isSelected`
                // remounts only the two rows whose state actually flipped.
                key={`${minutes}-${isSelected}`}
                testID={`reminder-default-${minutes ?? "none"}`}
                trailing={
                  <Icon
                    name={isSelected ? SELECTED_ICON : UNSELECTED_ICON}
                    size={18}
                  />
                }
                onPress={() => handleSelect(minutes)}
              >
                {reminderDefaultLabel(minutes, t)}
              </ListItem>
            );
          })}
          <FieldGroup.SectionFooter>
            <NativeText modifiers={[font({ textStyle: "footnote" })]}>
              {t("settings.notifications.defaultLeadDescription")}
            </NativeText>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
