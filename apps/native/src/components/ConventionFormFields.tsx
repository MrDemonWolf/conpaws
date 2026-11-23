// See components/ui/FieldRow.tsx — one Material surface per row.

import { Collapsible } from "@expo/ui";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { DatePicker as SwiftDatePicker } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { type ReactElement, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  Input,
  PRESS_DIM,
  Row,
  SafeView,
  TAP_TARGET,
  Text,
} from "@/components/ui";
import { FieldRow as ListItem } from "@/components/ui/FieldRow";
import { formatMediumDate } from "@/lib/event-time-format";
import {
  buildTimeZoneOptions,
  searchTimeZones,
  type TimeZoneOption,
  timeZoneLabel,
} from "@/lib/time-zone-search";
import { cn } from "@/lib/utils";

/**
 * Field components shared by the create and edit convention forms. They live
 * here rather than in either screen so the two cannot drift apart -- a date
 * picker that clamps on create but not on edit would be worse than no clamp.
 */

export interface ConventionDateFieldProps {
  title: string;
  value: Date;
  minimumDate?: Date;
  locale: string;
  timeZoneName?: string;
  colorScheme: "light" | "dark";
  onChange: (value: Date) => void;
}

export interface ConventionDateFieldParts {
  /** A direct child of `FieldGroup.Section`. */
  row: ReactElement;
  /** Rendered after the form's `Host`, outside the section. Android only. */
  dialog: ReactElement | null;
}

/**
 * A hook, not a component, so the section gets the row element itself. On
 * Android `FieldGroup.Section` keeps a row as-is only when it is the
 * universal `ListItem`; a component that renders one, or a fragment pairing
 * it with its picker, is wrapped in a second Compose `ListItem`.
 */
export function useConventionDateField({
  title,
  value,
  minimumDate,
  locale,
  timeZoneName,
  colorScheme,
  onChange,
}: ConventionDateFieldProps): ConventionDateFieldParts {
  const [dialogVisible, setDialogVisible] = useState(false);

  if (process.env.EXPO_OS === "ios") {
    return {
      row: (
        <SwiftDatePicker
          title={title}
          selection={value}
          range={{ start: minimumDate }}
          displayedComponents={["date"]}
          onDateChange={onChange}
          modifiers={[datePickerStyle("compact")]}
        />
      ),
      dialog: null,
    };
  }

  return {
    row: (
      <ListItem
        onPress={() => setDialogVisible(true)}
        supportingText={formatMediumDate(value, locale)}
      >
        {title}
      </ListItem>
    ),
    // The picker brings its own Host, so it stays out of the form's.
    dialog: dialogVisible ? (
      <DateTimePicker
        value={value}
        mode="date"
        minimumDate={minimumDate}
        locale={locale}
        timeZoneName={timeZoneName}
        themeVariant={colorScheme}
        presentation="dialog"
        onValueChange={(_, nextValue) => {
          onChange(nextValue);
          setDialogVisible(false);
        }}
        onDismiss={() => setDialogVisible(false)}
      />
    ) : null,
  };
}

/** Every zone the picker offers, with the device's zone ranked first. */
export function useTimeZoneOptions(deviceTimeZone: string): TimeZoneOption[] {
  return useMemo(
    () =>
      buildTimeZoneOptions(
        ["UTC", ...supportedValuesOf("timeZone")],
        deviceTimeZone,
      ),
    [deviceTimeZone],
  );
}

export interface ConventionTimeZoneFieldProps {
  timeZone: string;
  deviceTimeZone: string;
  /** Where the location cannot set the zone, Advanced starts open. */
  canInferTimeZone: boolean;
  onPick: (id: string) => void;
  testID: string;
}

export interface ConventionTimeZoneFieldParts {
  /** The Advanced disclosure holding the zone row; a direct child of `FieldGroup.Section`. */
  row: ReactElement;
  /** The search picker, rendered outside the form's `Host`. */
  modal: ReactElement;
  /**
   * Asks whether to fall back to the device's zone when the location could
   * not be turned into one. Resolves to that zone, or null after opening the
   * picker instead.
   */
  confirmDeviceFallback: () => Promise<string | null>;
}

/**
 * The time-zone row, its picker and the device-zone fallback prompt. A hook
 * for the same reason as `useConventionDateField`: the section must get the
 * `Collapsible` element itself.
 */
export function useConventionTimeZoneField({
  timeZone,
  deviceTimeZone,
  canInferTimeZone,
  onPick,
  testID,
}: ConventionTimeZoneFieldProps): ConventionTimeZoneFieldParts {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(!canInferTimeZone);
  const [pickerVisible, setPickerVisible] = useState(false);
  const timeZones = useTimeZoneOptions(deviceTimeZone);

  function confirmDeviceFallback(): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.alert(
        t("convention.timeZoneFallbackTitle"),
        t("convention.timeZoneFallbackMessage", {
          timeZone: timeZoneLabel(deviceTimeZone),
        }),
        [
          {
            text: t("convention.setTimeZone"),
            onPress: () => {
              setAdvancedOpen(true);
              setPickerVisible(true);
              resolve(null);
            },
          },
          {
            text: t("convention.useDeviceTimeZone"),
            onPress: () => resolve(deviceTimeZone),
          },
        ],
      );
    });
  }

  return {
    row: (
      <Collapsible
        label={t("common.advanced")}
        isOpen={advancedOpen}
        onOpenChange={setAdvancedOpen}
      >
        <ListItem
          supportingText={timeZoneLabel(timeZone)}
          testID={testID}
          onPress={() => {
            Keyboard.dismiss();
            setPickerVisible(true);
          }}
        >
          {t("convention.timeZone")}
        </ListItem>
      </Collapsible>
    ),
    modal: (
      <TimeZonePickerModal
        visible={pickerVisible}
        options={timeZones}
        selected={timeZone}
        onSelect={onPick}
        onClose={() => setPickerVisible(false)}
      />
    ),
    confirmDeviceFallback,
  };
}

export interface TimeZonePickerModalProps {
  visible: boolean;
  options: readonly TimeZoneOption[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function TimeZonePickerModal({
  visible,
  options,
  selected,
  onSelect,
  onClose,
}: TimeZonePickerModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchTimeZones(options, query),
    [options, query],
  );

  function handleClose() {
    setQuery("");
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // fullScreen, not pageSheet: this modal is presented from screens that
      // are themselves formSheet routes (create/edit), and presenting a sheet
      // from a sheet-presented controller is where iOS drops the presentation
      // — the picker's visible flag stays true with nothing on screen. A
      // full-screen cover cannot be interactively dismissed, fully occludes
      // the parent sheet, and keeps the same slide + Done button. Android
      // ignores presentationStyle entirely.
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      {/* The modal needs its own provider or it draws under the status bar.
          `SafeView` reads its insets from React context, and context crosses the
          Modal boundary — so this full-screen modal inherited the insets of
          whatever presented it. It is presented from create and edit, which are
          `formSheet` routes, and a sheet has a top inset of 0 because nothing of
          it reaches the status bar. The modal does reach it, so the title was
          drawn straight through the clock: "Search Time Zones" rendered as
          "Search5:00e Zones".

          A provider inside the modal measures that window instead of inheriting
          a number taken from a different one. */}
      <SafeAreaProvider>
        <SafeView edges={["top", "bottom"]}>
          <View className="flex-row items-center justify-between gap-4 px-4 py-3">
            <Text variant="h3">{t("convention.timeZoneSearch")}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleClose}
              className={cn(
                TAP_TARGET,
                "min-w-[48px] items-end justify-center",
                PRESS_DIM,
              )}
            >
              <Text variant="body" className="text-primary">
                {t("common.done")}
              </Text>
            </Pressable>
          </View>

          <View className="px-4 pb-3">
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t("convention.timeZoneSearchPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel={t("convention.timeZoneSearch")}
              testID="time-zone-search-input"
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentInsetAdjustmentBehavior="automatic"
            testID="time-zone-results"
            ListEmptyComponent={
              <View className="px-4 py-8">
                <Text
                  variant="body"
                  className="text-muted-foreground text-center"
                >
                  {t("convention.timeZoneNoResults", { query: query.trim() })}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selected;
              return (
                <Row
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelect(item.id);
                    handleClose();
                  }}
                  className="min-h-14 border-b border-border px-4 py-3"
                  trailing={
                    isSelected ? (
                      <Text variant="body" className="text-primary">
                        ✓
                      </Text>
                    ) : null
                  }
                >
                  <Text variant="body">{item.city}</Text>
                  <Text variant="caption" className="text-muted-foreground">
                    {item.region || item.id}
                  </Text>
                </Row>
              );
            }}
          />
        </SafeView>
      </SafeAreaProvider>
    </Modal>
  );
}
