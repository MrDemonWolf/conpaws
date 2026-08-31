import {
  Checkbox,
  Collapsible,
  FieldGroup,
  Host,
  ListItem,
  Button as NativeButton,
  Text as NativeText,
  TextInput as NativeTextInput,
  useNativeState,
} from "@expo/ui";
import { supportedValuesOf } from "@formatjs/intl-supportedvaluesof";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { getCalendars } from "expo-localization";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, Alert } from "react-native";
import { TimeZonePickerModal } from "@/components/ConventionFormFields";
import { FORM_SAFE_EDGES, FormModalHeader } from "@/components/FormModalHeader";
import { SafeView } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { useImportSchedule } from "@/hooks/useImportSchedule";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { isValidTimeZone } from "@/lib/convention-time";
import { developerToolsEnabled } from "@/lib/developer-tools";
import type { FeedSource } from "@/lib/feed-source";
import {
  type CategoryMeta,
  type ParsedEvent,
  parseIcs,
  UnsupportedRecurrenceError,
} from "@/lib/ical-parser";
import {
  canApplyScheduleImport,
  parseIcsPreferringFeedTimeZone,
} from "@/lib/import-policy";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import {
  fetchScheduleIcs,
  InvalidResponseError,
  InvalidScheduleUrlError,
  NetworkError,
  reversedSchedSuggestion,
  ScheduleFetchCancelledError,
  ScheduleTooLargeError,
} from "@/lib/sched-extractor";
import { setScheduleAllCategories } from "@/lib/schedule-refresh-storage";
import { scheduleNameFromUrl } from "@/lib/schedule-url";
import { buildTimeZoneOptions, timeZoneLabel } from "@/lib/time-zone-search";
import { hapticSuccess } from "@/services/haptics";
import {
  buildImportedConventionPatch,
  commitScheduleImport,
  deriveImportedConventionDates,
} from "@/services/schedule-import-commit";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

type Tab = "file" | "url";

interface ErrorState {
  type: "file-type" | "network" | "no-events" | "parse" | "timezone";
  message: string;
  /**
   * The underlying failure, untranslated, shown only where developer tools are
   * already enabled.
   *
   * `message` is deliberately vague -- "Check your connection and try again"
   * is the right thing to tell someone whose train went into a tunnel. But it
   * is the same sentence for a DNS failure, an ATS rejection and a 30s
   * timeout, and ConPaws fetches arbitrary third-party hosts under
   * `NSAllowsArbitraryLoads: false`. A server whose certificate chain is
   * incomplete loads fine in a Mac browser and fails only here, and without
   * the real message there is nothing to go on.
   */
  detail?: string;
}

interface PreviewState {
  name: string;
  icsContent: string;
  /** Which export this calendar came from. Shown so a wrong guess is visible. */
  source: FeedSource;
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
  const resolvedColorScheme = useResolvedColorScheme();
  const { colors } = useTheme();
  const seedColor = colors.primary;
  const queryClient = useQueryClient();
  const importMutation = useImportSchedule();
  const didPrefill = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [timeZonePickerVisible, setTimeZonePickerVisible] = useState(false);
  const filePickerLock = useRef(0);
  const requestGeneration = useRef(0);
  // The generation counter discards a superseded *result*; this stops the
  // *work*. Cancel leaves the screen, which unmounts and aborts here, so a
  // fetch no longer runs on to its 30s timeout behind a reader who has gone.
  const inFlightFetch = useRef<AbortController | null>(null);
  const isMounted = useRef(true);
  const urlInput = useNativeState("");

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
  const showDeveloperTools = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pendingCalendar, setPendingCalendar] =
    useState<PendingCalendar | null>(null);
  const [timeZone, setTimeZone] = useState("");
  const timeZoneOptions = useMemo(
    () =>
      buildTimeZoneOptions(
        ["UTC", ...supportedValuesOf("timeZone")],
        getCalendars()[0]?.timeZone ?? "UTC",
      ),
    [],
  );

  useEffect(
    () => () => {
      isMounted.current = false;
      inFlightFetch.current?.abort();
    },
    [],
  );

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
    // A new request supersedes the last one, so stop it rather than leaving it
    // to finish into a result nobody reads.
    inFlightFetch.current?.abort();
    inFlightFetch.current = null;
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
    fallbackTimeZone?: string,
    sourceUrl: string | null = null,
  ) {
    let result: ReturnType<typeof parseIcs>;
    try {
      // Fallback, not override: the calendar's own zone has to win, or a
      // convention whose saved zone differs from its feed's gets every event
      // retimed. See parseIcsPreferringFeedTimeZone.
      result = parseIcsPreferringFeedTimeZone(icsContent, fallbackTimeZone);
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
      setTimeZoneValue(fallbackTimeZone ?? "");
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
      source: result.source,
      events: result.events,
      categories: result.categories,
      cancelledSourceUids: result.cancelledSourceUids,
      selectedCategories: allCategories,
      sourceUrl,
    });
    setPendingCalendar(null);
    setTimeZoneValue(
      result.timezone ?? fallbackTimeZone ?? storedTimeZone ?? "",
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

    const controller = new AbortController();
    inFlightFetch.current = controller;

    try {
      const fetched = await fetchScheduleIcs(scheduleUrl, {
        signal: controller.signal,
      });
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
      // A cancellation is not a failure: the reader already knows, because
      // they are the one who caused it.
      if (err instanceof ScheduleFetchCancelledError) return;
      if (!isCurrentRequest(generation)) return;
      if (err instanceof InvalidScheduleUrlError) {
        setError({
          type: "file-type",
          message: t("import.errors.invalidUrl"),
        });
      } else if (err instanceof NetworkError) {
        // A reversed Sched address fails here, as DNS, and the generic
        // "check your connection" is wrong for it -- the connection is fine
        // and retrying never helps. Checked only after a real failure, so a
        // convention genuinely serving a schedule from its own sched.* host
        // is never blocked from importing.
        const suggestion = reversedSchedSuggestion(scheduleUrl);
        setError({
          type: "network",
          message: suggestion
            ? t("import.errors.reversedSchedUrl", { suggestion })
            : t("import.errors.network"),
          detail: err.message,
        });
      } else if (err instanceof InvalidResponseError) {
        setError({
          type: "no-events",
          message: t("import.errors.invalidResponse"),
          detail: err.message,
        });
      } else if (err instanceof ScheduleTooLargeError) {
        setError({
          type: "file-type",
          message: t("import.errors.tooLarge"),
          detail: err.message,
        });
      } else {
        setError({
          type: "parse",
          message: t("import.errors.generic"),
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      if (inFlightFetch.current === controller) inFlightFetch.current = null;
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

    const dates = deriveImportedConventionDates(
      reparsed.events,
      selectedTimeZone,
      new Date(),
    );

    const outcome = await commitScheduleImport(
      {
        conventionId: id,
        draft: dates
          ? {
              name: preview.name,
              startDate: dates.startDate,
              endDate: dates.endDate,
              timeZone: selectedTimeZone,
              icalUrl: preview.sourceUrl,
              status: dates.status,
            }
          : null,
        parsedEvents: eventsToImport,
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
        patch: buildImportedConventionPatch({
          dates,
          sourceUrl: preview.sourceUrl,
          timeZone: selectedTimeZone,
        }),
      },
      {
        createConvention: conventionsRepo.create,
        removeConvention: conventionsRepo.remove,
        importEvents: (importInput) => importMutation.mutateAsync(importInput),
        updateConvention: conventionsRepo.update,
        publishSnapshot: publishWidgetSnapshot,
        refreshCaches: (conventionId) =>
          Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ["conventions"] }),
            queryClient.invalidateQueries({
              queryKey: ["convention", conventionId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["events", conventionId],
            }),
          ]),
        haptic: hapticSuccess,
      },
    );

    if (!outcome.ok) {
      if (!isMounted.current) return;
      Alert.alert(t("import.alerts.failedTitle"), t("import.errors.generic"));
      return;
    }

    const { createdConventionId, conventionDetailsUpdated, result } = outcome;

    // Records whether this import took the whole feed, which is what decides
    // whether the convention may later be re-checked unattended. The category
    // checkboxes are screen state and vanish with this screen, so without this
    // flag a background refresh would quietly reinstate what the user removed.
    void setScheduleAllCategories(
      createdConventionId ?? id ?? "",
      preview.selectedCategories.size === preview.categories.length,
    );

    // The preview is spent: leaving it set makes the unsaved-changes guard
    // treat the Done button as an attempt to abandon work.
    setPreview(null);
    // The write finished, but the sheet may be gone. An alert fired from a
    // screen the user already closed arrives out of nowhere and its Done
    // button navigates them somewhere they did not ask to go.
    if (!isMounted.current) return;

    Alert.alert(
      t("import.alerts.successTitle"),
      [
        t("import.alerts.successSummary", {
          added: result.added,
          updated: result.updated,
          removed: result.removed,
        }),
        result.unresolved > 0
          ? t("import.alerts.unresolvedSeries", { count: result.unresolved })
          : null,
        conventionDetailsUpdated ? null : t("import.alerts.detailsNotUpdated"),
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

  // A built preview represents real work -- parsing plus per-event selection.
  // A running import counts too: dismissing the sheet mid-write leaves the
  // batch insert to finish against a screen that no longer exists.
  const { confirmDiscard: handleCancel } = useUnsavedChangesGuard({
    isDirty: importMutation.isPending || !!preview,
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
  // Same city/region searchable picker the create form uses — this section
  // used to be a substring filter over raw IANA identifiers, which handed a
  // first-time user strings like "America/Kentucky/Monticello" plus the word
  // "IANA" in three error messages.
  const timeZoneFields = (
    <ListItem
      supportingText={
        isValidTimeZone(timeZone) ? timeZoneLabel(timeZone) : undefined
      }
      testID="time-zone-picker"
      onPress={
        controlsDisabled ? undefined : () => setTimeZonePickerVisible(true)
      }
    >
      {t("import.timeZone.label")}
    </ListItem>
  );

  return (
    <SafeView edges={FORM_SAFE_EDGES}>
      {process.env.EXPO_OS === "ios" ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            onPress={handleCancel}
            // Only the database write is uninterruptible. A URL fetch can run
            // for the full 30s timeout, and disabling Cancel through it left
            // the one wait long enough to need an escape without one.
            disabled={importMutation.isPending}
          >
            {t("common.cancel")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <FormModalHeader
          title={t("import.title")}
          cancelLabel={t("common.cancel")}
          // FormModalHeader has no disabled state for Cancel, so the press
          // is dropped instead. Dropped only during the write — a fetch stays
          // cancellable, see the toolbar note above.
          onCancel={importMutation.isPending ? () => undefined : handleCancel}
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

          {/* Directly under the two things that start a load, not below the
              help section where it used to sit — on a phone with the keyboard
              up that put the only sign of progress off-screen, so tapping
              "Fetch schedule" looked like it had done nothing. HIG: put the
              feedback where the action happened. */}
          {loading ? (
            <FieldGroup.Section>
              {/* Untinted UIActivityIndicatorView — system gray, matching the
                  "checking…" rows in iOS Settings. */}
              <ListItem
                supportingText={t("import.loadingDescription")}
                trailing={<ActivityIndicator size="small" />}
              >
                {t("import.loading")}
              </ListItem>
            </FieldGroup.Section>
          ) : null}

          {/* Same placement rule as the loading row above, which used to be
              the only half of it that was honoured: this sat below the help
              section, so a failed fetch scrolled its own explanation off the
              screen and the button looked inert. Feedback belongs where the
              action was. */}
          {error && !loading ? (
            <FieldGroup.Section title={t("import.needsAttention")}>
              <ListItem supportingText={error.message}>
                {error.type === "timezone"
                  ? t("import.timeZone.requiredTitle")
                  : t("import.couldNotLoad")}
              </ListItem>
              {/* Untranslated on purpose: this is the failure verbatim, and a
                  translated stack trace helps nobody. Owner builds only. */}
              {showDeveloperTools && error.detail ? (
                <ListItem supportingText={error.detail}>
                  Developer detail
                </ListItem>
              ) : null}
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

          {/* The single biggest first-run stall was this screen assuming the
              user already knows what Sched or an .ics file is. */}
          <FieldGroup.Section>
            <Collapsible
              label={t("import.help.title")}
              isOpen={helpOpen}
              onOpenChange={setHelpOpen}
            >
              <ListItem supportingText={t("import.help.sched")}>
                {t("import.help.schedTitle")}
              </ListItem>
              <ListItem supportingText={t("import.help.ics")}>
                {t("import.help.icsTitle")}
              </ListItem>
              <ListItem supportingText={t("import.help.ask")}>
                {t("import.help.askTitle")}
              </ListItem>
            </Collapsible>
          </FieldGroup.Section>

          {preview && !loading && !error ? (
            <>
              <FieldGroup.Section title={t("import.preview")}>
                <ListItem
                  supportingText={`${t(
                    preview.events.length === 1
                      ? "import.eventFound"
                      : "import.eventsFound",
                    { count: preview.events.length },
                  )} · ${t(
                    preview.source === "sched"
                      ? "import.feedSource.sched"
                      : "import.feedSource.generic",
                  )}`}
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
              <FieldGroup.SectionFooter>
                <NativeText>{t("import.previewFooter")}</NativeText>
              </FieldGroup.SectionFooter>

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
      <TimeZonePickerModal
        visible={timeZonePickerVisible}
        options={timeZoneOptions}
        selected={isValidTimeZone(timeZone) ? timeZone : ""}
        onSelect={(value) => {
          setTimeZoneValue(value);
        }}
        onClose={() => setTimeZonePickerVisible(false)}
      />
    </SafeView>
  );
}
