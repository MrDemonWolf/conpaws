import SegmentedControl from "@expo/ui/community/segmented-control";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarX, FileX, WifiOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { Button, SafeView, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { useImportSchedule } from "@/hooks/useImportSchedule";
import { conventionDayKey, isValidTimeZone } from "@/lib/convention-time";
import {
  type CategoryMeta,
  type ParsedEvent,
  parseIcs,
  UnsupportedRecurrenceError,
} from "@/lib/ical-parser";
import { canApplyScheduleImport } from "@/lib/import-policy";
import {
  fetchSchedIcs,
  InvalidResponseError,
  InvalidSchedUrlError,
  NetworkError,
} from "@/lib/sched-extractor";

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

function normalizeSchedUrl(value: string): string {
  const parsed = new URL(value.trim());
  return `https://${parsed.hostname.toLowerCase()}`;
}

function confirmEmptyScheduleUpdate(removalCount: number): Promise<boolean> {
  const eventWord = removalCount === 1 ? "event" : "events";

  return new Promise((resolve) => {
    Alert.alert(
      "Apply empty schedule update?",
      `This Sched update has no active events. Applying it will remove exactly ${removalCount} imported ${eventWord} from this convention and cancel their local reminders. Manually added events will stay.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Apply Schedule Update",
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

export default function ImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const placeholderColor = colorScheme === "dark" ? "#94A3B8" : "#64748B";
  const queryClient = useQueryClient();
  const importMutation = useImportSchedule();
  const didPrefill = useRef(false);
  const requestGeneration = useRef(0);

  const { data: existingConvention } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id && id !== "new",
  });
  const storedTimeZone = isValidTimeZone(existingConvention?.timeZone)
    ? existingConvention.timeZone
    : null;

  const [activeTab, setActiveTab] = useState<Tab>("file");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pendingCalendar, setPendingCalendar] =
    useState<PendingCalendar | null>(null);
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    if (!existingConvention || didPrefill.current) return;
    didPrefill.current = true;
    if (storedTimeZone) setTimeZone(storedTimeZone);
    if (existingConvention.icalUrl) {
      setUrl(existingConvention.icalUrl);
      setActiveTab("url");
    }
  }, [existingConvention, storedTimeZone]);

  function clearState() {
    setError(null);
    setPreview(null);
    setPendingCalendar(null);
    setTimeZone(storedTimeZone ?? "");
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

  function handleTabChange(tab: Tab) {
    if (loading || importMutation.isPending) return;
    requestGeneration.current += 1;
    didPrefill.current = true;
    setLoading(false);
    setActiveTab(tab);
    clearState();
  }

  function handleUrlChange(value: string) {
    didPrefill.current = true;
    setUrl(value);
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
            ? parseError.message
            : "This calendar could not be parsed safely.",
      });
      return;
    }

    if (result.requiresTimeZone) {
      setPendingCalendar({ name, icsContent, sourceUrl });
      setTimeZone(selectedTimeZone ?? "");
      setError({
        type: "timezone",
        message:
          "Choose the furcon's IANA time zone so event times stay correct when you travel.",
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
        message: "No events found in this calendar file.",
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
    setTimeZone(result.timezone ?? selectedTimeZone ?? storedTimeZone ?? "");
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
    const generation = beginRequest();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/calendar", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });

      if (!isCurrentRequest(generation)) return;
      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.name.endsWith(".ics")) {
        setError({
          type: "file-type",
          message: "Please select a .ics calendar file.",
        });
        return;
      }

      const content = await new File(file.uri).text();
      if (!isCurrentRequest(generation)) return;
      processIcs(
        content,
        file.name.replace(/\.ics$/i, ""),
        storedTimeZone ?? undefined,
      );
    } catch {
      if (isCurrentRequest(generation)) {
        setError({ type: "parse", message: "Failed to read the file." });
      }
    } finally {
      if (isCurrentRequest(generation)) setLoading(false);
    }
  }

  async function handleUrlFetch() {
    const scheduleUrl = url.trim();
    if (!scheduleUrl) return;
    const generation = beginRequest();

    try {
      const content = await fetchSchedIcs(scheduleUrl);
      if (!isCurrentRequest(generation)) return;
      const normalizedUrl = normalizeSchedUrl(scheduleUrl);
      const name = new URL(normalizedUrl).hostname.split(".")[0];
      setUrl(normalizedUrl);
      processIcs(
        content,
        name || "Imported Convention",
        storedTimeZone ?? undefined,
        normalizedUrl,
      );
    } catch (err) {
      if (!isCurrentRequest(generation)) return;
      if (err instanceof InvalidSchedUrlError) {
        setError({
          type: "file-type",
          message: "Enter a valid Sched URL (e.g. https://yourcon.sched.com).",
        });
      } else if (err instanceof NetworkError) {
        setError({
          type: "network",
          message: "Network error. Check your connection and try again.",
        });
      } else if (err instanceof InvalidResponseError) {
        setError({
          type: "no-events",
          message: "URL did not return a valid calendar file.",
        });
      } else {
        setError({
          type: "parse",
          message: "Something went wrong. Please try again.",
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
        "Invalid Time Zone",
        "Use an IANA time zone such as America/Chicago.",
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
        "Import Not Applied",
        parseError instanceof UnsupportedRecurrenceError
          ? parseError.message
          : "This calendar could not be parsed safely. Nothing was changed.",
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
      Alert.alert("Nothing to Import", "Choose at least one event.");
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
          "Schedule Update Not Applied",
          "The app could not verify which imported events would be removed. Nothing was changed.",
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
      ? today < dateRange.startDate
        ? "upcoming"
        : today > dateRange.endDate
          ? "ended"
          : "active"
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
      }
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["conventions"] }),
        queryClient.invalidateQueries({
          queryKey: ["convention", conventionId],
        }),
        queryClient.invalidateQueries({ queryKey: ["events", conventionId] }),
      ]);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);

      Alert.alert(
        "Import Complete",
        `${result.added} added, ${result.updated} updated, ${result.removed} removed.${
          result.unresolved > 0
            ? ` ${result.unresolved} recurring series left unchanged because its older saved events could not be matched safely.`
            : ""
        }${
          conventionDetailsUpdated
            ? ""
            : " Events were saved, but the convention dates or saved Sched URL could not be refreshed."
        }`,
        [
          {
            text: "Done",
            onPress: () =>
              createdConventionId
                ? router.replace(`/convention/${createdConventionId}`)
                : router.back(),
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
      Alert.alert("Import Failed", "Something went wrong. Please try again.");
    }
  }

  const selectedCount = preview
    ? preview.events.filter(
        (e) =>
          e.category === null || preview.selectedCategories.has(e.category),
      ).length
    : 0;
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
  const controlsDisabled = loading || importMutation.isPending;

  return (
    <SafeView edges={["bottom"]}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text variant="h2" accessibilityRole="header">
          Import Schedule
        </Text>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityHint="Closes the import sheet"
        >
          Cancel
        </Button>
      </View>

      <View className="px-4 mb-4">
        <SegmentedControl
          values={["File", "Sched URL"]}
          selectedIndex={activeTab === "file" ? 0 : 1}
          enabled={!controlsDisabled}
          appearance={colorScheme === "dark" ? "dark" : "light"}
          tintColor={colorScheme === "dark" ? "#18B7F2" : "#006F91"}
          onChange={({ nativeEvent }) =>
            handleTabChange(
              nativeEvent.selectedSegmentIndex === 0 ? "file" : "url",
            )
          }
          testID="import-source-segmented-control"
        />
      </View>

      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        {/* Tab content */}
        {activeTab === "file" ? (
          <Button
            variant="outline"
            onPress={handleFilePick}
            disabled={controlsDisabled}
            className="mb-4"
          >
            Choose .ics File
          </Button>
        ) : (
          <View className="gap-3 mb-4">
            <TextInput
              value={url}
              onChangeText={handleUrlChange}
              placeholder="Paste a Sched event URL"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!controlsDisabled}
              accessibilityLabel="Sched schedule URL"
              accessibilityState={{ disabled: controlsDisabled }}
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
            <Button
              onPress={handleUrlFetch}
              disabled={!url.trim() || controlsDisabled}
            >
              Fetch Schedule
            </Button>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View
            className="items-center py-8"
            accessibilityRole="progressbar"
            accessibilityLabel="Loading schedule"
            accessibilityLiveRegion="polite"
            accessibilityState={{ busy: true }}
          >
            <ActivityIndicator color="#0FACED" />
            <Text variant="caption" className="mt-2">
              Loading...
            </Text>
          </View>
        )}

        {/* Error state */}
        {error && !loading && (
          <View className="items-center py-8 gap-3">
            {error.type === "network" ? (
              <WifiOff size={40} color="#94A3B8" />
            ) : error.type === "no-events" || error.type === "timezone" ? (
              <CalendarX size={40} color="#94A3B8" />
            ) : (
              <FileX size={40} color="#94A3B8" />
            )}
            <Text
              variant="body"
              className="text-center text-muted-foreground"
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              selectable
            >
              {error.message}
            </Text>
            {error.type === "timezone" ? (
              <View className="w-full gap-3">
                <TextInput
                  value={timeZone}
                  onChangeText={setTimeZone}
                  placeholder="America/Chicago"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Convention time zone"
                  className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
                />
                <Button
                  onPress={handleTimeZoneSubmit}
                  disabled={!isValidTimeZone(timeZone.trim())}
                >
                  Use Time Zone
                </Button>
              </View>
            ) : (
              <Button
                variant="outline"
                onPress={activeTab === "url" ? handleUrlFetch : handleFilePick}
              >
                Retry
              </Button>
            )}
          </View>
        )}

        {/* Preview */}
        {preview && !loading && !error && (
          <View className="gap-4">
            <Text
              variant="h3"
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
            >
              {preview.events.length} active event
              {preview.events.length === 1 ? "" : "s"} found
            </Text>
            {preview.cancelledSourceUids.length > 0 ? (
              <Text variant="caption" className="text-muted-foreground">
                {preview.cancelledSourceUids.length} cancellation
                {preview.cancelledSourceUids.length === 1 ? "" : "s"} will be
                reconciled.
              </Text>
            ) : null}
            {isEmptyAuthoritativeUpdate ? (
              <Text
                variant="body"
                className="text-destructive"
                accessibilityRole="alert"
              >
                This update has no active events. You will review the exact
                removal count before anything changes.
              </Text>
            ) : null}

            <View className="gap-2">
              <Text variant="label">Convention time zone</Text>
              <TextInput
                value={timeZone}
                onChangeText={setTimeZone}
                placeholder="America/Chicago"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                editable={!importMutation.isPending}
                accessibilityState={{ disabled: importMutation.isPending }}
                autoCorrect={false}
                accessibilityLabel="Convention time zone"
                className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
              />
              <Text variant="caption" className="text-muted-foreground">
                Use the furcon location, not your phone location.
              </Text>
            </View>

            {/* Category checkboxes */}
            {preview.categories.map((cat) => {
              const checked = preview.selectedCategories.has(cat.name);
              return (
                <Pressable
                  key={cat.name}
                  onPress={() => toggleCategory(cat.name)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${cat.name}, ${cat.count} event${cat.count === 1 ? "" : "s"}`}
                  accessibilityState={{
                    checked,
                    disabled: importMutation.isPending,
                  }}
                  disabled={importMutation.isPending}
                  className="flex-row items-center gap-3 py-2"
                >
                  <View
                    className={`w-5 h-5 rounded border-2 items-center justify-center ${
                      checked ? "bg-primary border-primary" : "border-border"
                    }`}
                  >
                    {checked && (
                      <Text className="text-primary-foreground text-xs font-bold">
                        ✓
                      </Text>
                    )}
                  </View>
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <Text variant="body" className="flex-1">
                    {cat.name}
                  </Text>
                  <Text variant="caption">{cat.count}</Text>
                </Pressable>
              );
            })}

            <View className="pt-2 pb-8 gap-3">
              <Button
                onPress={handleImport}
                disabled={
                  importMutation.isPending ||
                  !canApplyPreview ||
                  !isValidTimeZone(timeZone.trim())
                }
              >
                {importMutation.isPending
                  ? isEmptyAuthoritativeUpdate
                    ? "Applying..."
                    : "Importing..."
                  : isEmptyAuthoritativeUpdate
                    ? "Apply Schedule Update"
                    : `Import ${selectedCount} Event${selectedCount !== 1 ? "s" : ""}`}
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeView>
  );
}
