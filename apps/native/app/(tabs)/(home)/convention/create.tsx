import {
  Collapsible,
  FieldGroup,
  Host,
  ListItem,
  Button as NativeButton,
  Text as NativeText,
  TextInput,
} from "@expo/ui";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { DatePicker as SwiftDatePicker } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import * as Haptics from "expo-haptics";
import { getCalendars } from "expo-localization";
import { router, Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  TextInput as RNTextInput,
  useColorScheme,
  View,
} from "react-native";
import {
  ConventionDateField,
  TimeZonePickerModal,
} from "@/components/ConventionFormFields";
import { SafeView, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import {
  conventionDayKey,
  conventionStatusForDay,
  isValidTimeZone,
} from "@/lib/convention-time";
import {
  buildTimeZoneOptions,
  searchTimeZones,
  type TimeZoneOption,
  timeZoneLabel,
} from "@/lib/time-zone-search";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

export default function CreateConventionScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";
  const { colors } = useTheme();
  const seedColor = colors.primary;
  const deviceTimeZone = getCalendars()[0]?.timeZone ?? "UTC";
  const [name, setName] = useState("");
  const [timeZone, setTimeZone] = useState(deviceTimeZone);
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [endDate, setEndDate] = useState(() =>
    addDays(startOfDay(new Date()), 1),
  );
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeZonePickerVisible, setTimeZonePickerVisible] = useState(false);
  const timeZones = useMemo(
    () =>
      buildTimeZoneOptions(
        ["UTC", ...supportedValuesOf("timeZone")],
        deviceTimeZone,
      ),
    [deviceTimeZone],
  );
  function updateStartDate(value: Date) {
    setStartDate(value);
    if (endDate < value) setEndDate(value);
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    const trimmedTimeZone = timeZone.trim();

    if (!trimmedName) {
      Alert.alert(t("common.error"), t("convention.nameRequired"));
      return;
    }
    if (!isValidTimeZone(trimmedTimeZone)) {
      Alert.alert(t("common.error"), t("convention.timeZoneInvalid"));
      return;
    }

    const startDateKey = format(startDate, "yyyy-MM-dd");
    const endDateKey = format(endDate, "yyyy-MM-dd");
    const today = conventionDayKey(new Date(), trimmedTimeZone);
    let conventionId: string;

    setSaving(true);
    try {
      const convention = await conventionsRepo.create({
        name: trimmedName,
        startDate: startDateKey,
        endDate: endDateKey,
        timeZone: trimmedTimeZone,
        icalUrl: null,
        status: conventionStatusForDay(startDateKey, endDateKey, today),
      });
      queryClient.setQueryData(["convention", convention.id], convention);
      queryClient.setQueryData(["events", convention.id], []);
      conventionId = convention.id;
    } catch {
      Alert.alert(t("common.error"), t("convention.createError"));
      setSaving(false);
      return;
    }

    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["conventions"] }),
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ]);
    await publishWidgetSnapshot().catch(() => false);
    router.replace(`/convention/${conventionId}`);
  }

  const validTimeZone = isValidTimeZone(timeZone) ? timeZone : undefined;
  const canCreate =
    !saving && name.trim().length > 0 && isValidTimeZone(timeZone);

  return (
    <SafeView edges={["bottom"]}>
      {process.env.EXPO_OS === "ios" ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button onPress={() => router.back()}>
              {t("common.cancel")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              onPress={handleCreate}
              disabled={!canCreate}
              variant="done"
            >
              {t("common.add")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        </>
      ) : (
        <View className="flex-row items-center px-3 py-2">
          <View className="flex-1 items-start">
            <Host colorScheme={resolvedColorScheme} matchContents>
              <NativeButton
                label={t("common.cancel")}
                onPress={() => router.back()}
                variant="text"
              />
            </Host>
          </View>
          <Text variant="h3" className="text-center">
            {t("convention.new")}
          </Text>
          <View className="flex-1 items-end">
            <Host
              colorScheme={resolvedColorScheme}
              seedColor={seedColor}
              matchContents
            >
              <NativeButton
                label={t("common.add")}
                onPress={handleCreate}
                disabled={!canCreate}
              />
            </Host>
          </View>
        </View>
      )}

      <Host
        colorScheme={resolvedColorScheme}
        seedColor={seedColor}
        style={{ flex: 1 }}
        useViewportSizeMeasurement
      >
        <FieldGroup>
          <FieldGroup.Section>
            <ListItem
              supportingText={
                <TextInput
                  defaultValue={name}
                  onChangeText={setName}
                  placeholder={t("convention.namePlaceholder")}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  testID="convention-name-input"
                />
              }
            >
              {t("convention.name")}
            </ListItem>
            <ConventionDateField
              title={t("convention.startDate")}
              value={startDate}
              locale={i18n.language}
              timeZoneName={validTimeZone}
              colorScheme={resolvedColorScheme}
              onChange={updateStartDate}
            />
            <ConventionDateField
              title={t("convention.endDate")}
              value={endDate}
              minimumDate={startDate}
              locale={i18n.language}
              timeZoneName={validTimeZone}
              colorScheme={resolvedColorScheme}
              onChange={(value) =>
                setEndDate(value < startDate ? startDate : value)
              }
            />
            <Collapsible
              label={t("common.advanced")}
              isOpen={advancedOpen}
              onOpenChange={setAdvancedOpen}
            >
              <ListItem
                supportingText={timeZoneLabel(timeZone)}
                testID="time-zone-picker"
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeZonePickerVisible(true);
                }}
              >
                {t("convention.timeZone")}
              </ListItem>
            </Collapsible>
            <FieldGroup.SectionFooter>
              <NativeText>{t("convention.timeZoneAdvancedHelp")}</NativeText>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>

      <TimeZonePickerModal
        visible={timeZonePickerVisible}
        options={timeZones}
        selected={timeZone}
        onSelect={setTimeZone}
        onClose={() => setTimeZonePickerVisible(false)}
      />
    </SafeView>
  );
}
