import { Collapsible, FieldGroup, Host, TextInput } from "@expo/ui";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, max, parseISO } from "date-fns";
import { getCalendars } from "expo-localization";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Keyboard, View } from "react-native";
import tzLookup from "tz-lookup";
import {
  TimeZonePickerModal,
  useConventionDateField,
} from "@/components/ConventionFormFields";
import { FormModalHeader } from "@/components/FormModalHeader";
import {
  FORM_PRESENTED_AS_SHEET,
  FORM_SAFE_EDGES,
} from "@/components/FormModalHeader.shared";
import { FormSkeleton, SafeView } from "@/components/ui";
import { FieldRow as ListItem } from "@/components/ui/FieldRow";
import { NativeText } from "@/components/ui/NativeText";
import * as conventionsRepo from "@/db/repositories/conventions";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { useReadableFieldGroup } from "@/hooks/useReadableFieldGroup";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  conventionFormFooter,
  isConventionUnchanged,
  validateConventionForm,
} from "@/lib/convention-form";
import {
  canInferTimeZoneFromLocation,
  decideTimeZoneForLocationEdit,
  inferTimeZoneFromLocation,
  normalizeLocationName,
} from "@/lib/convention-location";
import {
  conventionDayKey,
  conventionStatusForDay,
} from "@/lib/convention-time";
import { currentLocale } from "@/lib/i18n";
import { buildTimeZoneOptions, timeZoneLabel } from "@/lib/time-zone-search";
import {
  commitConventionUpdate,
  saveConventionEdit,
} from "@/services/convention-commit";
import { hapticSuccess } from "@/services/haptics";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

/** Parses a stored `yyyy-MM-dd` key into a local noon Date, avoiding DST edges. */
function dayKeyToDate(dayKey: string): Date {
  return parseISO(`${dayKey}T12:00:00`);
}

export default function EditConventionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const resolvedColorScheme = useResolvedColorScheme();
  // A form sheet on iOS, where the sheet sets the width; a full-screen
  // modal on Android, where the window does.
  const readableGroup = useReadableFieldGroup({
    inSheet: FORM_PRESENTED_AS_SHEET,
  });
  const locale = currentLocale();
  const { colors } = useTheme();
  const seedColor = colors.primary;
  const deviceTimeZone = getCalendars()[0]?.timeZone ?? "UTC";
  // Only iOS can turn the location into a zone. Elsewhere a location edit
  // keeps the stored zone, and Advanced starts open so the zone row is the
  // visible way to change it.
  const canInferTimeZone = canInferTimeZoneFromLocation();

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
  // Only the write itself, not the geocode before it, lets the sheet go
  // without asking. See saveConventionEdit.
  const [writing, setWriting] = useState(false);
  // `saving` only reaches the buttons on the next render; the ref stops a
  // second tap that lands before then.
  const saveLock = useRef(false);
  const isMounted = useRef(true);
  const [advancedOpen, setAdvancedOpen] = useState(!canInferTimeZone);
  const [timeZonePickerVisible, setTimeZonePickerVisible] = useState(false);
  // Seed the form from storage exactly once. Re-seeding on every query settle
  // would silently discard whatever the user is part-way through typing.
  // This is state rather than a ref because the form must not mount until it
  // holds real values: @expo/ui's TextInput reads defaultValue at mount only,
  // so a field mounted before the query resolves stays empty forever.
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  function updateStartDate(value: Date) {
    setStartDate(value);
    // Dragging the start past the end would otherwise leave the form in an
    // invalid state the user did not ask for.
    if (endDate < value) setEndDate(value);
  }

  const dateTimeZone = validation.errors.timeZone ? undefined : timeZone;
  const startDateField = useConventionDateField({
    title: t("convention.startDate"),
    value: startDate,
    locale,
    timeZoneName: dateTimeZone,
    colorScheme: resolvedColorScheme,
    onChange: updateStartDate,
  });
  const endDateField = useConventionDateField({
    title: t("convention.endDate"),
    value: endDate,
    minimumDate: startDate,
    locale,
    timeZoneName: dateTimeZone,
    colorScheme: resolvedColorScheme,
    onChange: (value) => setEndDate(max([value, startDate])),
  });

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
      canInfer: canInferTimeZone,
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
    // Asking over a form that has already closed would offer to save it.
    if (!isMounted.current) return null;
    return confirmDeviceTimeZoneFallback();
  }

  async function handleSave() {
    if (!convention || !validation.valid || unchanged) return;
    const conventionId = convention.id;

    await saveConventionEdit(saveLock, {
      resolveTimeZone: resolveTimeZoneForSave,
      commit: async (resolvedTimeZone) => {
        const resolvedValidation = validateConventionForm({
          ...values,
          timeZone: resolvedTimeZone,
        });
        if (!resolvedValidation.valid) return null;
        const { cleaned } = resolvedValidation;
        const today = conventionDayKey(new Date(), cleaned.timeZone);

        return commitConventionUpdate(
          conventionId,
          {
            name: cleaned.name,
            startDate: cleaned.startDate,
            endDate: cleaned.endDate,
            timeZone: cleaned.timeZone,
            location: cleaned.location || null,
            // Dates may have moved across today, so the stored status has to
            // be recomputed rather than left as it was.
            status: conventionStatusForDay(
              cleaned.startDate,
              cleaned.endDate,
              today,
            ),
          },
          {
            update: conventionsRepo.update,
            refreshCaches: (id) =>
              Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ["convention", id] }),
                queryClient.invalidateQueries({ queryKey: ["conventions"] }),
              ]),
            publishSnapshot: publishWidgetSnapshot,
            haptic: hapticSuccess,
          },
        );
      },
      isMounted: () => isMounted.current,
      setSaving,
      setWriting,
      onWriteFailed: () =>
        Alert.alert(t("common.error"), t("convention.updateError")),
      leave: () => router.back(),
    });
  }

  const canSave = !saving && validation.valid && !unchanged;
  // Armed through the geocode after Save, which can take ten seconds: the iOS
  // sheet stays swipeable, and a swipe that closed it unasked dropped the edit.
  const { confirmDiscard: handleCancel } = useUnsavedChangesGuard({
    isDirty: !writing && !unchanged,
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
            <Stack.Toolbar.Button onPress={handleCancel} disabled={saving}>
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
          // FormModalHeader has no disabled state for Cancel, so the press is
          // dropped while saving, as on the create form.
          onCancel={saving ? () => undefined : handleCancel}
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
        <FieldGroup {...readableGroup}>
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

            {startDateField.row}
            {endDateField.row}

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
            {/* @expo/ui keeps only a section's last footer, so this one
                carries the name limit and the long-span warning as well:
                Save greys out with its reason in view. */}
            <FieldGroup.SectionFooter>
              <NativeText>{conventionFormFooter(validation, t)}</NativeText>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
      {startDateField.dialog}
      {endDateField.dialog}

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
