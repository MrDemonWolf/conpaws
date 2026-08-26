import {
  Collapsible,
  FieldGroup,
  Host,
  ListItem,
  Text as NativeText,
  TextInput,
} from "@expo/ui";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { getCalendars } from "expo-localization";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Keyboard, useColorScheme, View } from "react-native";
import tzLookup from "tz-lookup";
import {
  ConventionDateField,
  TimeZonePickerModal,
} from "@/components/ConventionFormFields";
import { FORM_SAFE_EDGES, FormModalHeader } from "@/components/FormModalHeader";
import { FormSkeleton, SafeView } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  CONVENTION_NAME_MAX_LENGTH,
  conventionNameLength,
  isConventionUnchanged,
  validateConventionForm,
} from "@/lib/convention-form";
import {
  decideTimeZoneForLocationEdit,
  inferTimeZoneFromLocation,
  normalizeLocationName,
} from "@/lib/convention-location";
import {
  conventionDayKey,
  conventionStatusForDay,
} from "@/lib/convention-time";
import { buildTimeZoneOptions, timeZoneLabel } from "@/lib/time-zone-search";
import { hapticSuccess } from "@/services/haptics";
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
  const [location, setLocation] = useState("");
  const [timeZone, setTimeZone] = useState(deviceTimeZone);
  const [timeZoneManuallySet, setTimeZoneManuallySet] = useState(false);
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
    setLocation(convention.location ?? "");
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
    location,
  };
  const validation = validateConventionForm(values);
  const original = convention
    ? {
        name: convention.name,
        startDate: convention.startDate,
        endDate: convention.endDate,
        timeZone: convention.timeZone ?? deviceTimeZone,
        location: convention.location ?? "",
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

  function confirmDeviceTimeZoneFallback(): Promise<string | null> {
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
              setTimeZonePickerVisible(true);
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

  async function resolveTimeZoneForSave(): Promise<string | null> {
    const normalizedLocation = normalizeLocationName(location);
    const originalLocation = normalizeLocationName(convention?.location ?? "");
    const decision = decideTimeZoneForLocationEdit({
      location: normalizedLocation,
      originalLocation,
      manuallySet: timeZoneManuallySet,
    });
    if (decision.action === "keep") {
      return timeZone.trim() || deviceTimeZone;
    }

    const inferred = await inferTimeZoneFromLocation(
      normalizedLocation,
      Location.geocodeAsync,
      tzLookup,
    );
    if (inferred) {
      setTimeZone(inferred);
      return inferred;
    }
    return confirmDeviceTimeZoneFallback();
  }

  async function handleSave() {
    if (!convention || !validation.valid || unchanged) return;

    const resolvedTimeZone = await resolveTimeZoneForSave();
    if (!resolvedTimeZone) return;
    const resolvedValidation = validateConventionForm({
      ...values,
      timeZone: resolvedTimeZone,
    });
    if (!resolvedValidation.valid) return;
    const { cleaned } = resolvedValidation;
    const today = conventionDayKey(new Date(), cleaned.timeZone);

    setSaving(true);
    try {
      await conventionsRepo.update(convention.id, {
        name: cleaned.name,
        startDate: cleaned.startDate,
        endDate: cleaned.endDate,
        timeZone: cleaned.timeZone,
        location: cleaned.location || null,
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

    hapticSuccess();
    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: ["convention", convention.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["conventions"] }),
    ]);
    await publishWidgetSnapshot().catch(() => false);
    router.back();
  }

  const canSave = !saving && validation.valid && !unchanged;
  const { confirmDiscard: handleCancel } = useUnsavedChangesGuard({
    isDirty: !saving && !unchanged,
    onDiscard: () => router.back(),
  });

  const showLoading = useDelayedLoading(isLoading || !convention || !seeded);

  if (isLoading || !convention || !seeded) {
    return (
      <SafeView edges={FORM_SAFE_EDGES}>
        {showLoading ? <FormSkeleton /> : <View className="flex-1" />}
      </SafeView>
    );
  }

  return (
    <SafeView edges={FORM_SAFE_EDGES}>
      {process.env.EXPO_OS === "ios" ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button onPress={handleCancel}>
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
        <FormModalHeader
          title={t("convention.edit")}
          cancelLabel={t("common.cancel")}
          onCancel={handleCancel}
          confirmLabel={t("common.save")}
          onConfirm={handleSave}
          confirmDisabled={!canSave}
        />
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
            <ListItem
              supportingText={
                <TextInput
                  defaultValue={location}
                  onChangeText={setLocation}
                  placeholder={t("convention.locationPlaceholder")}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  testID="edit-convention-location-input"
                />
              }
            >
              {t("convention.location")}
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
        onSelect={(value) => {
          setTimeZone(value);
          setTimeZoneManuallySet(true);
        }}
        onClose={() => setTimeZonePickerVisible(false)}
      />
    </SafeView>
  );
}
