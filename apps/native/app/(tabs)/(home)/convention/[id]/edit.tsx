import {
  Collapsible,
  FieldGroup,
  Host,
  ListItem,
  Button as NativeButton,
  Text as NativeText,
  TextInput,
} from "@expo/ui";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import * as Haptics from "expo-haptics";
import { getCalendars } from "expo-localization";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Keyboard, useColorScheme, View } from "react-native";
import {
  ConventionDateField,
  TimeZonePickerModal,
} from "@/components/ConventionFormFields";
import { LoadingSpinner, SafeView, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import {
  CONVENTION_NAME_MAX_LENGTH,
  conventionNameLength,
  isConventionUnchanged,
  validateConventionForm,
} from "@/lib/convention-form";
import {
  conventionDayKey,
  conventionStatusForDay,
} from "@/lib/convention-time";
import { buildTimeZoneOptions, timeZoneLabel } from "@/lib/time-zone-search";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

/** Parses a stored `yyyy-MM-dd` key into a local noon Date, avoiding DST edges. */
function dayKeyToDate(dayKey: string): Date {
  return parseISO(`${dayKey}T12:00:00`);
}

export default function EditConventionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";
  const { colors } = useTheme();
  const seedColor = colors.primary;
  const deviceTimeZone = getCalendars()[0]?.timeZone ?? "UTC";

  const { data: convention, isLoading } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id,
  });

  const [name, setName] = useState("");
  const [timeZone, setTimeZone] = useState(deviceTimeZone);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeZonePickerVisible, setTimeZonePickerVisible] = useState(false);
  // Seed the form from storage exactly once. Re-seeding on every query settle
  // would silently discard whatever the user is part-way through typing.
  // This is state rather than a ref because the form must not mount until it
  // holds real values: @expo/ui's TextInput reads defaultValue at mount only,
  // so a field mounted before the query resolves stays empty forever.
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!convention || seeded) return;
    setName(convention.name);
    setStartDate(dayKeyToDate(convention.startDate));
    setEndDate(dayKeyToDate(convention.endDate));
    setTimeZone(convention.timeZone ?? deviceTimeZone);
    setSeeded(true);
  }, [convention, deviceTimeZone, seeded]);

  const timeZones = useMemo(
    () =>
      buildTimeZoneOptions(
        ["UTC", ...supportedValuesOf("timeZone")],
        deviceTimeZone,
      ),
    [deviceTimeZone],
  );

  const values = {
    name,
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
    timeZone,
  };
  const validation = validateConventionForm(values);
  const original = convention
    ? {
        name: convention.name,
        startDate: convention.startDate,
        endDate: convention.endDate,
        timeZone: convention.timeZone ?? deviceTimeZone,
      }
    : null;
  const unchanged = original ? isConventionUnchanged(values, original) : true;
  const nameLength = conventionNameLength(name);

  function updateStartDate(value: Date) {
    setStartDate(value);
    // Dragging the start past the end would otherwise leave the form in an
    // invalid state the user did not ask for.
    if (endDate < value) setEndDate(value);
  }

  async function handleSave() {
    if (!convention || !validation.valid || unchanged) return;

    const { cleaned } = validation;
    const today = conventionDayKey(new Date(), cleaned.timeZone);

    setSaving(true);
    try {
      await conventionsRepo.update(convention.id, {
        name: cleaned.name,
        startDate: cleaned.startDate,
        endDate: cleaned.endDate,
        timeZone: cleaned.timeZone,
        // Dates may have moved across today, so the stored status has to be
        // recomputed rather than left as it was.
        status: conventionStatusForDay(
          cleaned.startDate,
          cleaned.endDate,
          today,
        ),
      });
    } catch {
      Alert.alert(t("common.error"), t("convention.updateError"));
      setSaving(false);
      return;
    }

    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: ["convention", convention.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["conventions"] }),
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ]);
    await publishWidgetSnapshot().catch(() => false);
    router.back();
  }

  const canSave = !saving && validation.valid && !unchanged;

  if (isLoading || !convention || !seeded) {
    return (
      <SafeView edges={["bottom"]}>
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner />
        </View>
      </SafeView>
    );
  }

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
              onPress={handleSave}
              disabled={!canSave}
              variant="done"
            >
              {t("common.save")}
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
            {t("convention.edit")}
          </Text>
          <View className="flex-1 items-end">
            <Host
              colorScheme={resolvedColorScheme}
              seedColor={seedColor}
              matchContents
            >
              <NativeButton
                label={t("common.save")}
                onPress={handleSave}
                disabled={!canSave}
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
                  testID="edit-convention-name-input"
                />
              }
            >
              {t("convention.name")}
            </ListItem>
            {validation.errors.name === "nameTooLong" ? (
              <FieldGroup.SectionFooter>
                <NativeText>
                  {t("convention.nameTooLong", {
                    max: CONVENTION_NAME_MAX_LENGTH,
                  })}
                </NativeText>
              </FieldGroup.SectionFooter>
            ) : nameLength > CONVENTION_NAME_MAX_LENGTH - 15 ? (
              // Only surface the counter as the limit gets close; showing it
              // always is noise on a name that is nowhere near the bound.
              <FieldGroup.SectionFooter>
                <NativeText>
                  {t("convention.nameCounter", {
                    count: nameLength,
                    max: CONVENTION_NAME_MAX_LENGTH,
                  })}
                </NativeText>
              </FieldGroup.SectionFooter>
            ) : null}

            <ConventionDateField
              title={t("convention.startDate")}
              value={startDate}
              locale={i18n.language}
              timeZoneName={validation.errors.timeZone ? undefined : timeZone}
              colorScheme={resolvedColorScheme}
              onChange={updateStartDate}
            />
            <ConventionDateField
              title={t("convention.endDate")}
              value={endDate}
              minimumDate={startDate}
              locale={i18n.language}
              timeZoneName={validation.errors.timeZone ? undefined : timeZone}
              colorScheme={resolvedColorScheme}
              onChange={(value) =>
                setEndDate(value < startDate ? startDate : value)
              }
            />
            {validation.warnings.longSpan ? (
              <FieldGroup.SectionFooter>
                <NativeText>
                  {t("convention.longSpan", {
                    count: validation.warnings.longSpan,
                  })}
                </NativeText>
              </FieldGroup.SectionFooter>
            ) : null}

            <Collapsible
              label={t("common.advanced")}
              isOpen={advancedOpen}
              onOpenChange={setAdvancedOpen}
            >
              <ListItem
                supportingText={timeZoneLabel(timeZone)}
                testID="edit-time-zone-picker"
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeZonePickerVisible(true);
                }}
              >
                {t("convention.timeZone")}
              </ListItem>
            </Collapsible>
            <FieldGroup.SectionFooter>
              <NativeText>
                {validation.errors.timeZone
                  ? t("convention.timeZoneInvalid")
                  : t("convention.timeZoneAdvancedHelp")}
              </NativeText>
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
