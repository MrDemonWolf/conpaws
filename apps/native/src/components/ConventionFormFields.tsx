import { ListItem } from "@expo/ui";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { DatePicker as SwiftDatePicker } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Modal,
  Pressable,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { SafeView, Text, usePlaceholderTextColor } from "@/components/ui";
import { searchTimeZones, type TimeZoneOption } from "@/lib/time-zone-search";

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

export function ConventionDateField({
  title,
  value,
  minimumDate,
  locale,
  timeZoneName,
  colorScheme,
  onChange,
}: ConventionDateFieldProps) {
  const [dialogVisible, setDialogVisible] = useState(false);

  if (process.env.EXPO_OS === "ios") {
    return (
      <SwiftDatePicker
        title={title}
        selection={value}
        range={{ start: minimumDate }}
        displayedComponents={["date"]}
        onDateChange={onChange}
        modifiers={[datePickerStyle("compact")]}
      />
    );
  }

  return (
    <>
      <ListItem
        onPress={() => setDialogVisible(true)}
        supportingText={new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
        }).format(value)}
      >
        {title}
      </ListItem>
      {dialogVisible ? (
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
      ) : null}
    </>
  );
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
  const placeholderColor = usePlaceholderTextColor();
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
      <SafeView edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between gap-4 px-4 py-3">
          <Text variant="h3">{t("convention.timeZoneSearch")}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleClose}
            className="min-h-12 min-w-12 items-end justify-center active:opacity-70"
          >
            <Text variant="body" className="text-primary">
              {t("common.done")}
            </Text>
          </Pressable>
        </View>

        <View className="px-4 pb-3">
          <RNTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("convention.timeZoneSearchPlaceholder")}
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel={t("convention.timeZoneSearch")}
            testID="time-zone-search-input"
            className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
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
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onSelect(item.id);
                  handleClose();
                }}
                className="min-h-14 flex-row items-center justify-between gap-4 border-b border-border px-4 py-3 active:opacity-70"
              >
                <View className="flex-1">
                  <Text variant="body">{item.city}</Text>
                  <Text variant="caption" className="text-muted-foreground">
                    {item.region || item.id}
                  </Text>
                </View>
                {isSelected ? (
                  <Text variant="body" className="text-primary">
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      </SafeView>
    </Modal>
  );
}
