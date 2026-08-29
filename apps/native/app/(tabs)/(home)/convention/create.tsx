import {
  Collapsible,
  FieldGroup,
  Host,
  ListItem,
  Text as NativeText,
  TextInput,
} from "@expo/ui";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import { getCalendars } from "expo-localization";
import * as Location from "expo-location";
import { router, Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Keyboard } from "react-native";
import tzLookup from "tz-lookup";
import {
  ConventionDateField,
  TimeZonePickerModal,
} from "@/components/ConventionFormFields";
import { FORM_SAFE_EDGES, FormModalHeader } from "@/components/FormModalHeader";
import { SafeView } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  inferTimeZoneFromLocation,
  normalizeLocationName,
} from "@/lib/convention-location";
import {
  conventionDayKey,
  conventionStatusForDay,
  isValidTimeZone,
} from "@/lib/convention-time";
import { currentLocale } from "@/lib/i18n";
import { buildTimeZoneOptions, timeZoneLabel } from "@/lib/time-zone-search";
import { commitNewConvention } from "@/services/convention-commit";
import { hapticSuccess } from "@/services/haptics";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

export default function CreateConventionScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const resolvedColorScheme = useResolvedColorScheme();
  const locale = currentLocale();
  const { colors } = useTheme();
  const seedColor = colors.primary;
  const deviceTimeZone = getCalendars()[0]?.timeZone ?? "UTC";
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [timeZone, setTimeZone] = useState(deviceTimeZone);
  const [timeZoneManuallySet, setTimeZoneManuallySet] = useState(false);
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [endDate, setEndDate] = useState(() =>
    addDays(startOfDay(new Date()), 1),
  );
  const [saving, setSaving] = useState(false);
  const isMounted = useRef(true);
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
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    [],
  );

  function updateStartDate(value: Date) {
    setStartDate(value);
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
    if (!normalizedLocation || timeZoneManuallySet) return timeZone.trim();

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

  async function handleCreate() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(t("common.error"), t("convention.nameRequired"));
      return;
    }
    if (!isValidTimeZone(timeZone.trim())) {
      Alert.alert(t("common.error"), t("convention.timeZoneInvalid"));
      return;
    }

    // Set before the geocode, not after it. Resolving a time zone from a
    // location is a throttled network call that can take seconds, and leaving
    // the form live across that window let a second Save tap create a second
    // convention.
    setSaving(true);
    const resolvedTimeZone = await resolveTimeZoneForSave();
    if (!resolvedTimeZone) {
      setSaving(false);
      return;
    }
    // The user may have left while the geocode was in flight. Writing a
    // convention they walked away from, and then dragging them into it, is
    // worse than doing nothing.
    if (!isMounted.current) return;

    const startDateKey = format(startDate, "yyyy-MM-dd");
    const endDateKey = format(endDate, "yyyy-MM-dd");
    const today = conventionDayKey(new Date(), resolvedTimeZone);

    const outcome = await commitNewConvention(
      {
        name: trimmedName,
        startDate: startDateKey,
        endDate: endDateKey,
        timeZone: resolvedTimeZone,
        location: normalizeLocationName(location) || null,
        icalUrl: null,
        status: conventionStatusForDay(startDateKey, endDateKey, today),
      },
      {
        create: conventionsRepo.create,
        seedCaches: (convention) => {
          queryClient.setQueryData(["convention", convention.id], convention);
          queryClient.setQueryData(["events", convention.id], []);
        },
        invalidateList: () =>
          queryClient.invalidateQueries({ queryKey: ["conventions"] }),
        publishSnapshot: publishWidgetSnapshot,
        haptic: hapticSuccess,
      },
    );

    if (!outcome.ok) {
      Alert.alert(t("common.error"), t("convention.createError"));
      setSaving(false);
      return;
    }
    if (!isMounted.current) return;
    router.replace(`/convention/${outcome.conventionId}`);
  }

  const validTimeZone = isValidTimeZone(timeZone) ? timeZone : undefined;
  const canCreate =
    !saving && name.trim().length > 0 && isValidTimeZone(timeZone);

  // Any typed input counts as dirty; the untouched dates are defaults, not input.
  const isDirty =
    !saving && (name.trim().length > 0 || location.trim().length > 0);
  const { confirmDiscard: handleCancel } = useUnsavedChangesGuard({
    isDirty,
    onDiscard: () => router.back(),
  });

  return (
    <SafeView edges={FORM_SAFE_EDGES}>
      {process.env.EXPO_OS === "ios" ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button onPress={handleCancel} disabled={saving}>
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
        <FormModalHeader
          title={t("convention.new")}
          cancelLabel={t("common.cancel")}
          // FormModalHeader has no disabled state for Cancel, so the press is
          // dropped instead. See the handoff note in the audit report.
          onCancel={saving ? () => undefined : handleCancel}
          confirmLabel={t("common.add")}
          onConfirm={handleCreate}
          confirmDisabled={!canCreate}
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
                  testID="convention-name-input"
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
                  testID="convention-location-input"
                />
              }
            >
              {t("convention.location")}
            </ListItem>
            {/* The location silently drives a geocode on save that sets the
                time zone and can take seconds — say so instead of looking
                like a cosmetic field. */}
            <FieldGroup.SectionFooter>
              <NativeText>{t("convention.locationTimeZoneNote")}</NativeText>
            </FieldGroup.SectionFooter>
            <ConventionDateField
              title={t("convention.startDate")}
              value={startDate}
              locale={locale}
              timeZoneName={validTimeZone}
              colorScheme={resolvedColorScheme}
              onChange={updateStartDate}
            />
            <ConventionDateField
              title={t("convention.endDate")}
              value={endDate}
              minimumDate={startDate}
              locale={locale}
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
        onSelect={(value) => {
          setTimeZone(value);
          setTimeZoneManuallySet(true);
        }}
        onClose={() => setTimeZonePickerVisible(false)}
      />
    </SafeView>
  );
}
