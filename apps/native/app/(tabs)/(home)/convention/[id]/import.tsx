import {
  Checkbox,
  FieldGroup,
  Host,
  ListItem,
  Button as NativeButton,
  Text as NativeText,
  TextInput as NativeTextInput,
  Picker,
  useNativeState,
} from "@expo/ui";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { getCalendars } from "expo-localization";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  Keyboard,
  useColorScheme,
} from "react-native";
import { FORM_SAFE_EDGES, FormModalHeader } from "@/components/FormModalHeader";
import { SafeView } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { useImportSchedule } from "@/hooks/useImportSchedule";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  conventionDayKey,
  conventionStatusForDay,
  isValidTimeZone,
} from "@/lib/convention-time";
import {
  type CategoryMeta,
  type ParsedEvent,
  parseIcs,
  UnsupportedRecurrenceError,
} from "@/lib/ical-parser";
import { canApplyScheduleImport } from "@/lib/import-policy";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import {
  fetchScheduleIcs,
  InvalidResponseError,
  InvalidScheduleUrlError,
  NetworkError,
  ScheduleTooLargeError,
} from "@/lib/sched-extractor";
import { scheduleNameFromUrl } from "@/lib/schedule-url";
import { hapticSuccess } from "@/services/haptics";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

type Tab = "file" | "url";

interface ErrorState {
  type: "file-type" | "network" | "no-events" | "parse" | "timezone";
  message: string;
}

interface PreviewState {
  name: string;
  icsContent: string;
  events: ParsedEvent[];
  categories: CategoryMeta[];
  cancelledSourceUids: string[];
  selectedCategories: Set<string>;
  sourceUrl: string | null;
}

interface PendingCalendar {
  name: string;
  icsContent: string;
  sourceUrl: string | null;
}

export default function ImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";
  const { colors } = useTheme();
  const seedColor = colors.primary;
  const queryClient = useQueryClient();
  const importMutation = useImportSchedule();
  const didPrefill = useRef(false);
  const filePickerLock = useRef(false);
  const requestGeneration = useRef(0);
  const urlInput = useNativeState("");
  const deviceTimeZone = getCalendars()[0]?.timeZone ?? "UTC";

  const { data: existingConvention } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id && id !== "new",
  });
  const storedTimeZone = isValidTimeZone(existingConvention?.timeZone)
    ? existingConvention.timeZone
    : null;

  // Records which source was last used so Retry re-runs the right one. Not a
  // UI mode any more -- both sources are always on screen.
  const [activeTab, setActiveTab] = useState<Tab>("file");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pendingCalendar, setPendingCalendar] =
    useState<PendingCalendar | null>(null);
  const [timeZone, setTimeZone] = useState("");
  const [timeZoneSearch, setTimeZoneSearch] = useState("");
  const timeZones = useMemo(
    () => [
      deviceTimeZone,
      ...[...new Set(["UTC", ...supportedValuesOf("timeZone")])]
        .filter((value) => value !== deviceTimeZone)
        .sort(),
    ],
    [deviceTimeZone],
  );
  const filteredTimeZones = useMemo(() => {
    const query = timeZoneSearch.trim().toLocaleLowerCase();
    const matches = query
      ? timeZones.filter((value) => value.toLocaleLowerCase().includes(query))
      : timeZones;

    return isValidTimeZone(timeZone) && !matches.includes(timeZone)
      ? [timeZone, ...matches]
      : matches;
  }, [timeZone, timeZoneSearch, timeZones]);

  useEffect(() => {
    if (!existingConvention || didPrefill.current) return;
    didPrefill.current = true;
    if (storedTimeZone) {
      setTimeZone(storedTimeZone);
    }
    if (existingConvention.icalUrl) {
      urlInput.value = existingConvention.icalUrl;
      setUrl(existingConvention.icalUrl);
      setActiveTab("url");
    }
  }, [existingConvention, storedTimeZone, urlInput]);

  function setUrlValue(value: string) {
    urlInput.value = value;
    setUrl(value);
  }

  function setTimeZoneValue(value: string) {
    setTimeZone(value);
  }

  function clearState() {
    setError(null);
    setPreview(null);
    setPendingCalendar(null);
    setTimeZoneValue(storedTimeZone ?? "");
  }

  function beginRequest(): number {
    requestGeneration.current += 1;
    didPrefill.current = true;
    clearState();
    setLoading(true);
    return requestGeneration.current;
  }

  function isCurrentRequest(generation: number): boolean {
    return requestGeneration.current === generation;
  }

  function handleUrlChange(value: string) {
    didPrefill.current = true;
    setUrlValue(value);
  }

  function confirmEmptyScheduleUpdate(removalCount: number): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        t("import.alerts.emptyUpdateTitle"),
        t(
          removalCount === 1
            ? "import.alerts.emptyUpdateEvent"
            : "import.alerts.emptyUpdateEvents",
          { count: removalCount },
        ),
        [
          {
            text: t("common.cancel"),
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: t("import.applyUpdate"),
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => resolve(false),
        },
      );
    });
  }

  function processIcs(
    icsContent: string,
    name: string,
    selectedTimeZone?: string,
    sourceUrl: string | null = null,
  ) {
    let result: ReturnType<typeof parseIcs>;
    try {
      result = parseIcs(
        icsContent,
        selectedTimeZone ? { timeZone: selectedTimeZone } : undefined,
      );
    } catch (parseError) {
      setPreview(null);
      setPendingCalendar(null);
      setError({
        type: "parse",
        message:
          parseError instanceof UnsupportedRecurrenceError
            ? t("import.errors.unsupportedRecurrence", {
                properties: parseError.properties.join(", "),
              })
            : t("import.errors.parse"),
      });
      return;
    }

    if (result.requiresTimeZone) {
      setPendingCalendar({ name, icsContent, sourceUrl });
      setTimeZoneValue(selectedTimeZone ?? "");
      setError({
        type: "timezone",
        message: t("import.timeZone.requiredMessage"),
      });
      return;
    }

    if (
      !canApplyScheduleImport({
        conventionId: id,
        sourceUrl,
        selectedEventCount: result.events.length,
        sourceEventCount: result.events.length,
        cancelledEventCount: result.cancelledSourceUids.length,
      })
    ) {
      setError({
        type: "no-events",
        message: t("import.errors.noEvents"),
      });
      return;
    }

    const allCategories = new Set(
      result.categories.map((category) => category.name),
    );
    setPreview({
      name,
      icsContent,
      events: result.events,
      categories: result.categories,
      cancelledSourceUids: result.cancelledSourceUids,
      selectedCategories: allCategories,
      sourceUrl,
    });
    setPendingCalendar(null);
    setTimeZoneValue(
      result.timezone ?? selectedTimeZone ?? storedTimeZone ?? "",
    );
  }

  function handleTimeZoneSubmit() {
    if (!pendingCalendar || !isValidTimeZone(timeZone.trim())) return;
    setError(null);
    processIcs(
      pendingCalendar.icsContent,
      pendingCalendar.name,
      timeZone.trim(),
      pendingCalendar.sourceUrl,
    );
  }

  async function handleFilePick() {
    if (!tryAcquirePresentationLock(filePickerLock)) return;
    setActiveTab("file");
    const generation = beginRequest();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/calendar", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });

      if (isCurrentRequest(generation) && !result.canceled) {
        const file = result.assets[0];
        if (!file.name.endsWith(".ics")) {
          setError({
            type: "file-type",
            message: t("import.errors.fileType"),
          });
        } else {
          const content = await new File(file.uri).text();
          if (isCurrentRequest(generation)) {
            processIcs(
              content,
              file.name.replace(/\.ics$/i, ""),
              storedTimeZone ?? undefined,
            );
          }
        }
      }
    } catch {
      if (isCurrentRequest(generation)) {
        setError({ type: "parse", message: t("import.errors.fileRead") });
      }
    }
    resetPresentationLock(filePickerLock);
    if (isCurrentRequest(generation)) setLoading(false);
  }

  async function handleUrlFetch() {
    const scheduleUrl = url.trim();
    if (!scheduleUrl) return;
    const generation = beginRequest();

    setActiveTab("url");

    try {
      const fetched = await fetchScheduleIcs(scheduleUrl);
      if (!isCurrentRequest(generation)) return;
      // Store the canonical form, not what was typed: a webcal link has been
      // rewritten to https and a Sched page collapsed to its site root, and
      // that resolved value is what a later refresh should re-fetch.
      setUrlValue(fetched.canonicalUrl);
      processIcs(
        fetched.icsContent,
        scheduleNameFromUrl(fetched.canonicalUrl) ||
          t("import.importedConvention"),
        storedTimeZone ?? undefined,
        fetched.canonicalUrl,
      );
    } catch (err) {
      if (!isCurrentRequest(generation)) return;
      if (err instanceof InvalidScheduleUrlError) {
        setError({
          type: "file-type",
          message: t("import.errors.invalidUrl"),
        });
      } else if (err instanceof NetworkError) {
        setError({
          type: "network",
          message: t("import.errors.network"),
        });
      } else if (err instanceof InvalidResponseError) {
        setError({
          type: "no-events",
          message: t("import.errors.invalidResponse"),
        });
      } else if (err instanceof ScheduleTooLargeError) {
        setError({
          type: "file-type",
          message: t("import.errors.tooLarge"),
        });
      } else {
        setError({
          type: "parse",
          message: t("import.errors.generic"),
        });
      }
    } finally {
      if (isCurrentRequest(generation)) setLoading(false);
    }
  }

  function toggleCategory(name: string) {
    if (!preview) return;
    const next = new Set(preview.selectedCategories);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setPreview({ ...preview, selectedCategories: next });
  }

  async function handleImport() {
    if (!preview || !id) return;

    const selectedTimeZone = timeZone.trim();
    if (!isValidTimeZone(selectedTimeZone)) {
      Alert.alert(
        t("import.alerts.invalidTimeZoneTitle"),
        t("import.alerts.invalidTimeZoneMessage"),
      );
      return;
    }

    let reparsed: ReturnType<typeof parseIcs>;
    try {
      reparsed = parseIcs(preview.icsContent, {
        timeZone: selectedTimeZone,
      });
    } catch (parseError) {
      Alert.alert(
        t("import.alerts.notAppliedTitle"),
        parseError instanceof UnsupportedRecurrenceError
          ? t("import.errors.unsupportedRecurrence", {
              properties: parseError.properties.join(", "),
            })
          : t("import.alerts.parseNotApplied"),
      );
      return;
    }

    const eventsToImport =
      preview.selectedCategories.size === preview.categories.length
        ? reparsed.events
        : reparsed.events.filter(
            (event) =>
              event.category === null ||
              preview.selectedCategories.has(event.category),
          );
    if (
      !canApplyScheduleImport({
        conventionId: id,
        sourceUrl: preview.sourceUrl,
        selectedEventCount: eventsToImport.length,
        sourceEventCount: reparsed.events.length,
        cancelledEventCount: reparsed.cancelledSourceUids.length,
      })
    ) {
      Alert.alert(
        t("import.alerts.nothingTitle"),
        t("import.alerts.nothingMessage"),
      );
      return;
    }

    const isEmptyAuthoritativeUpdate =
      id !== "new" &&
      preview.sourceUrl !== null &&
      reparsed.events.length === 0;
    if (isEmptyAuthoritativeUpdate) {
      let removalCount: number;
      try {
        const existingEvents = await eventsRepo.getByConventionId(id);
        removalCount = existingEvents.filter(
          (event) => event.sourceUid !== null,
        ).length;
      } catch {
        Alert.alert(
          t("import.alerts.updateNotAppliedTitle"),
          t("import.alerts.updateNotAppliedMessage"),
        );
        return;
      }

      if (!(await confirmEmptyScheduleUpdate(removalCount))) return;
    }

    const timestamps = reparsed.events.map((event) =>
      event.startTime.getTime(),
    );
    const dateRange =
      timestamps.length > 0
        ? {
            startDate: conventionDayKey(
              new Date(Math.min(...timestamps)),
              selectedTimeZone,
            ),
            endDate: conventionDayKey(
              new Date(Math.max(...timestamps)),
              selectedTimeZone,
            ),
          }
        : null;
    const today = conventionDayKey(new Date(), selectedTimeZone);
    const status = dateRange
      ? conventionStatusForDay(dateRange.startDate, dateRange.endDate, today)
      : null;

    let createdConventionId: string | null = null;
    let shouldRollbackCreatedConvention = false;

    try {
      let conventionId = id;
      if (id === "new") {
        if (!dateRange || !status) {
          throw new Error("A new convention needs at least one active event");
        }
        const convention = await conventionsRepo.create({
          name: preview.name,
          ...dateRange,
          timeZone: selectedTimeZone,
          icalUrl: preview.sourceUrl,
          status,
        });
        conventionId = convention.id;
        createdConventionId = convention.id;
        shouldRollbackCreatedConvention = true;
      }

      const result = await importMutation.mutateAsync({
        parsedEvents: eventsToImport,
        conventionId,
        sourceSnapshot: {
          authoritative: preview.sourceUrl !== null,
          activeOccurrences: reparsed.events.map((event) => ({
            sourceUid: event.sourceUid,
            legacySourceUid: event.legacySourceUid,
            startTime: event.startTime.toISOString(),
            recurrenceTime: event.recurrenceTime?.toISOString() ?? null,
            title: event.title,
            sourceUrl: event.sourceUrl,
          })),
          cancelledOccurrences: reparsed.cancelledEvents.map((event) => ({
            sourceUid: event.sourceUid,
            legacySourceUid: event.legacySourceUid,
            startTime: event.startTime?.toISOString() ?? null,
            recurrenceTime: event.recurrenceTime?.toISOString() ?? null,
            title: event.title,
            sourceUrl: event.sourceUrl,
          })),
        },
      });
      shouldRollbackCreatedConvention = false;
      let conventionDetailsUpdated = true;
      if (!createdConventionId) {
        const sourceUpdate = preview.sourceUrl
          ? { icalUrl: preview.sourceUrl }
          : {};
        try {
          if (dateRange && status) {
            await conventionsRepo.update(conventionId, {
              ...dateRange,
              ...sourceUpdate,
              timeZone: selectedTimeZone,
              status,
            });
          } else {
            await conventionsRepo.update(conventionId, {
              ...sourceUpdate,
              timeZone: selectedTimeZone,
            });
          }
        } catch {
          conventionDetailsUpdated = false;
        }
        if (conventionDetailsUpdated) {
          await publishWidgetSnapshot().catch(() => false);
        }
      }
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["conventions"] }),
        queryClient.invalidateQueries({
          queryKey: ["convention", conventionId],
        }),
        queryClient.invalidateQueries({ queryKey: ["events", conventionId] }),
      ]);

      hapticSuccess();

      Alert.alert(
        t("import.alerts.successTitle"),
        [
          t("import.alerts.successSummary", {
            added: result.added,
            updated: result.updated,
            removed: result.removed,
          }),
          result.unresolved > 0
            ? t("import.alerts.unresolvedSeries", {
                count: result.unresolved,
              })
            : null,
          conventionDetailsUpdated
            ? null
            : t("import.alerts.detailsNotUpdated"),
        ]
          .filter(Boolean)
          .join(" "),
        [
          {
            text: t("common.done"),
            onPress: () =>
              createdConventionId
                ? router.replace(`/convention/${createdConventionId}`)
                : closeImport(),
          },
        ],
      );
    } catch {
      if (createdConventionId && shouldRollbackCreatedConvention) {
        try {
          await conventionsRepo.remove(createdConventionId);
        } catch {
          // The original import error is still the useful failure to report.
        }
      }
      Alert.alert(t("import.alerts.failedTitle"), t("import.errors.generic"));
    }
  }

  const selectedCount = preview
    ? preview.events.filter(
        (e) =>
          e.category === null || preview.selectedCategories.has(e.category),
      ).length
    : 0;
  const accessibilityAnnouncement = loading
    ? `${t("import.loading")}. ${t("import.loadingDescription")}`
    : error?.message ||
      (preview
        ? t(
            preview.events.length === 1
              ? "import.eventFound"
              : "import.eventsFound",
            {
              count: preview.events.length,
            },
          )
        : "");

  useEffect(() => {
    if (accessibilityAnnouncement) {
      AccessibilityInfo.announceForAccessibility(accessibilityAnnouncement);
    }
  }, [accessibilityAnnouncement]);

  const canApplyPreview = preview
    ? canApplyScheduleImport({
        conventionId: id,
        sourceUrl: preview.sourceUrl,
        selectedEventCount: selectedCount,
        sourceEventCount: preview.events.length,
        cancelledEventCount: preview.cancelledSourceUids.length,
      })
    : false;
  const isEmptyAuthoritativeUpdate =
    !!preview &&
    !!id &&
    id !== "new" &&
    preview.sourceUrl !== null &&
    preview.events.length === 0;
  const closeImport = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (id === "new") {
      router.replace("/(tabs)/(home)");
    } else {
      router.replace(`/convention/${id}`);
    }
  };

  // A built preview represents real work — parsing plus per-event selection.
  const { confirmDiscard: handleCancel } = useUnsavedChangesGuard({
    isDirty: !importMutation.isPending && !!preview,
    onDiscard: closeImport,
  });

  const controlsDisabled = loading || importMutation.isPending;
  const importActionLabel = importMutation.isPending
    ? isEmptyAuthoritativeUpdate
      ? t("import.applying")
      : t("import.importing")
    : isEmptyAuthoritativeUpdate
      ? t("import.applyUpdate")
      : t(selectedCount === 1 ? "import.importEvent" : "import.importEvents", {
          count: selectedCount,
        });
  const timeZoneFields = (
    <>
      <ListItem
        supportingText={
          <NativeTextInput
            defaultValue={timeZoneSearch}
            onChangeText={setTimeZoneSearch}
            placeholder={t("convention.timeZoneSearchPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!controlsDisabled}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            testID="time-zone-search-input"
          />
        }
      >
        {t("convention.timeZoneSearch")}
      </ListItem>
      <ListItem
        trailing={
          <Picker
            selectedValue={isValidTimeZone(timeZone) ? timeZone : ""}
            onValueChange={(value) => {
              setTimeZoneValue(String(value));
              Keyboard.dismiss();
            }}
            appearance="menu"
            enabled={!controlsDisabled}
            testID="time-zone-picker"
          >
            <Picker.Item label={t("import.timeZone.choose")} value="" />
            {filteredTimeZones.map((value) => (
              <Picker.Item key={value} label={value} value={value} />
            ))}
          </Picker>
        }
      >
        {t("import.timeZone.label")}
      </ListItem>
    </>
  );

  return (
    <SafeView edges={FORM_SAFE_EDGES}>
      {process.env.EXPO_OS === "ios" ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={handleCancel}>
            {t("common.cancel")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <FormModalHeader
          title={t("import.title")}
          cancelLabel={t("common.cancel")}
          onCancel={handleCancel}
        />
      )}

      <Host
        colorScheme={resolvedColorScheme}
        seedColor={seedColor}
        style={{ flex: 1 }}
        useViewportSizeMeasurement
      >
        <FieldGroup>
          {/* Both sources stay visible. Choosing between two options used to
              sit behind a menu picker, which cost two taps to reveal what the
              screen could simply show. */}
          <FieldGroup.Section title={t("import.source")}>
            <ListItem
              onPress={controlsDisabled ? undefined : handleFilePick}
              supportingText={t("import.fileDescription")}
              trailing={t("import.chooseFile")}
              testID="import-file-row"
            >
              {t("import.file")}
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section>
            <ListItem
              supportingText={
                <NativeTextInput
                  value={urlInput}
                  onChangeText={handleUrlChange}
                  placeholder={t("import.urlPlaceholder")}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleUrlFetch}
                  editable={!controlsDisabled}
                  testID="sched-url-input"
                />
              }
            >
              {t("import.url")}
            </ListItem>
            <NativeButton
              label={t("import.fetchSchedule")}
              onPress={handleUrlFetch}
              disabled={!url.trim() || controlsDisabled}
              style={{ height: 48 }}
            />
            <FieldGroup.SectionFooter>
              <NativeText>{t("import.linkHelp")}</NativeText>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          {loading ? (
            <FieldGroup.Section>
              <ListItem supportingText={t("import.loadingDescription")}>
                {t("import.loading")}
              </ListItem>
            </FieldGroup.Section>
          ) : null}

          {error && !loading ? (
            <FieldGroup.Section title={t("import.needsAttention")}>
              <ListItem supportingText={error.message}>
                {error.type === "timezone"
                  ? t("import.timeZone.requiredTitle")
                  : t("import.couldNotLoad")}
              </ListItem>
              {error.type === "timezone" ? (
                <>
                  {timeZoneFields}
                  <NativeButton
                    label={t("import.timeZone.use")}
                    onPress={handleTimeZoneSubmit}
                    disabled={!isValidTimeZone(timeZone.trim())}
                    style={{ height: 48 }}
                  />
                </>
              ) : (
                <NativeButton
                  label={t("common.retry")}
                  variant="outlined"
                  onPress={
                    activeTab === "url" ? handleUrlFetch : handleFilePick
                  }
                  style={{ height: 48 }}
                />
              )}
            </FieldGroup.Section>
          ) : null}

          {preview && !loading && !error ? (
            <>
              <FieldGroup.Section title={t("import.preview")}>
                <ListItem
                  supportingText={t(
                    preview.events.length === 1
                      ? "import.eventFound"
                      : "import.eventsFound",
                    { count: preview.events.length },
                  )}
                >
                  {preview.name}
                </ListItem>
                {preview.cancelledSourceUids.length > 0 ? (
                  <ListItem>
                    {t(
                      preview.cancelledSourceUids.length === 1
                        ? "import.cancellation"
                        : "import.cancellations",
                      { count: preview.cancelledSourceUids.length },
                    )}
                  </ListItem>
                ) : null}
                {isEmptyAuthoritativeUpdate ? (
                  <ListItem supportingText={t("import.emptyUpdateMessage")}>
                    {t("import.emptyUpdateTitle")}
                  </ListItem>
                ) : null}
              </FieldGroup.Section>

              <FieldGroup.Section title={t("import.timeZone.sectionTitle")}>
                {timeZoneFields}
                <FieldGroup.SectionFooter>
                  <NativeText>{t("import.timeZone.help")}</NativeText>
                </FieldGroup.SectionFooter>
              </FieldGroup.Section>

              {preview.categories.length > 0 ? (
                <FieldGroup.Section title={t("import.categories")}>
                  {preview.categories.map((category) => (
                    <Checkbox
                      key={category.name}
                      value={preview.selectedCategories.has(category.name)}
                      onValueChange={() => toggleCategory(category.name)}
                      label={t(
                        category.count === 1
                          ? "import.categoryEvent"
                          : "import.categoryEvents",
                        { name: category.name, count: category.count },
                      )}
                      disabled={importMutation.isPending}
                      testID={`category-${category.name}`}
                    />
                  ))}
                </FieldGroup.Section>
              ) : null}

              <FieldGroup.Section>
                <NativeButton
                  label={importActionLabel}
                  onPress={handleImport}
                  disabled={
                    importMutation.isPending ||
                    !canApplyPreview ||
                    !isValidTimeZone(timeZone.trim())
                  }
                  style={{ height: 48 }}
                />
              </FieldGroup.Section>
            </>
          ) : null}
        </FieldGroup>
      </Host>
    </SafeView>
  );
}
