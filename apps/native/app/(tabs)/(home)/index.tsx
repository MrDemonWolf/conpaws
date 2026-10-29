import AddIcon from "@expo/material-symbols/add.xml";
import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import EditCalendarIcon from "@expo/material-symbols/edit_calendar.xml";
import SearchIcon from "@expo/material-symbols/search.xml";
import SortIcon from "@expo/material-symbols/sort.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { ConventionList } from "@/components/ConventionList";
import {
  Button,
  ConventionListSkeleton,
  EmptyState,
  SkeletonUnderHeader,
  Text,
} from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention } from "@/db/schema";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import {
  type ConventionSort,
  canUnarchive,
  conventionDaysUntil,
  conventionStatusAt,
  partitionConventions,
  sortConventions,
} from "@/lib/convention-list";
import {
  type ConventionRowActionId,
  conventionRowActions,
} from "@/lib/convention-row-actions";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { formatConventionDate } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import { addPreviewConventions } from "@/lib/preview-convention";
import { clearScheduleRefreshState } from "@/lib/schedule-refresh-storage";
import { cancelConventionReminders } from "@/services/notifications";

const EMPTY_ICON = Icon.select({
  ios: "calendar.badge.plus",
  android: CalendarAddIcon,
});

const ERROR_ICON = Icon.select({
  ios: "exclamationmark.triangle",
  android: WarningIcon,
});

const DEVICE_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
// Dates go through event-time-format's cache; only the collator is cached
// here, because that module formats and does not sort.
// ponytail: supported locales are finite; keep expensive Intl objects per locale.
const collatorCache = new Map<string, Intl.Collator>();

function localeCollator(locale: string): Intl.Collator {
  const cached = collatorCache.get(locale);
  if (cached) return cached;

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  collatorCache.set(locale, collator);
  return collator;
}

interface ConventionEmptyStateProps {
  title: string;
  subtitle: string;
  createLabel: string;
  importLabel: string;
  findLabel: string;
  onFind: () => void;
  onCreate: () => void;
  onImport: () => void;
  onAddSamples?: () => void;
  addingSamples: boolean;
}

function ConventionEmptyState({
  title,
  subtitle,
  createLabel,
  importLabel,
  findLabel,
  onFind,
  onCreate,
  onImport,
  onAddSamples,
  addingSamples,
}: ConventionEmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-1">
      <EmptyState
        icon={EMPTY_ICON}
        title={title}
        subtitle={subtitle}
        ctaLabel={findLabel}
        onCta={onFind}
        secondaryCtaLabel={importLabel}
        onSecondaryCta={onImport}
        secondaryCtaVariant="outlined"
        actionsInline
        className="w-full flex-none"
      />
      <Button variant="ghost" onPress={onCreate} className="w-full">
        {createLabel}
      </Button>
      {onAddSamples ? (
        <View className="w-full gap-1 px-6">
          <Button
            variant="outline"
            onPress={onAddSamples}
            loading={addingSamples}
            testID="home-add-sample-conventions"
          >
            Add sample conventions
          </Button>
          <Text variant="caption" className="text-center text-muted-foreground">
            Fictional schedules for testing. Your saved conventions stay
            unchanged.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ConventionSort>("upcoming");
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const presentationLock = useRef(0);
  const appVariant = Constants.expoConfig?.extra?.appVariant;
  const showSamples = developerToolsEnabled(__DEV__, appVariant);
  const locale = currentLocale();
  const nameCollator = localeCollator(locale);
  const deviceTimeZone = DEVICE_TIME_ZONE;

  // `now` is state refreshed on focus, not `new Date()` per render. The rows
  // live inside a SwiftUI Host, and a value that changes every render rebuilds
  // the entire SwiftUI tree on every state change — which visibly cancels an
  // in-progress swipe action. Focus is also when the lock resets, so both
  // "the screen came back" concerns update together.
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
      setNow(new Date());
    }, []),
  );

  const {
    data: conventions = [],
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["conventions"],
    queryFn: conventionsRepo.getAll,
  });
  const { current: currentConventions, archived: archivedConventions } =
    useMemo(() => {
      const sorted = sortConventions(
        conventions,
        sort,
        nameCollator.compare,
        now,
        deviceTimeZone,
      );
      return partitionConventions(sorted, now, deviceTimeZone);
    }, [conventions, sort, nameCollator, now]);

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: Pick<Convention, "id" | "name">) => {
      const events = await eventsRepo.getByConventionId(id);
      await conventionsRepo.remove(id);
      return events.map((event) => event.id);
    },
    onSuccess: async (eventIds, { id, name }) => {
      queryClient.removeQueries({ queryKey: ["events", id] });
      await queryClient
        .invalidateQueries({ queryKey: ["conventions"] })
        .catch(() => undefined);
      await cancelConventionReminders(eventIds);
      // The feed bookkeeping is keyed by convention id, so without this a
      // deleted convention leaves its "last checked" behind for a future id
      // to inherit.
      await clearScheduleRefreshState(id);
      AccessibilityInfo.announceForAccessibility(
        t("home.delete.success", { name }),
      );
    },
    onError: () => {
      Alert.alert(t("home.delete.errorTitle"), t("home.delete.errorMessage"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const eventIds = await eventsRepo.getIdsByConventionId(id);
      await conventionsRepo.archive(id);
      await cancelConventionReminders(eventIds);
    },
    onSuccess: async (_, id) => {
      const convention = conventions.find((item) => item.id === id);
      await queryClient.invalidateQueries({ queryKey: ["conventions"] });
      if (convention) {
        AccessibilityInfo.announceForAccessibility(
          t("home.archive.success", { name: convention.name }),
        );
      }
    },
    onError: () => {
      Alert.alert(t("home.archive.errorTitle"), t("home.archive.errorMessage"));
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: conventionsRepo.unarchive,
    onSuccess: async (_, id) => {
      const convention = conventions.find((item) => item.id === id);
      await queryClient.invalidateQueries({ queryKey: ["conventions"] });
      if (convention) {
        AccessibilityInfo.announceForAccessibility(
          t("home.unarchive.success", { name: convention.name }),
        );
      }
    },
    onError: () => {
      Alert.alert(
        t("home.unarchive.errorTitle"),
        t("home.unarchive.errorMessage"),
      );
    },
  });

  const sampleMutation = useMutation({
    mutationFn: () => addPreviewConventions(__DEV__, appVariant),
    onSuccess: async (id) => {
      if (!id) {
        resetPresentationLock(presentationLock);
        return;
      }
      await Promise.all(
        ["conventions", "convention", "events", "schedule"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      router.push({ pathname: "/convention/[id]", params: { id } });
    },
    onError: () => {
      resetPresentationLock(presentationLock);
      Alert.alert(
        "Samples could not be added",
        "Try again. Your saved conventions were not replaced.",
      );
    },
  });

  const rowActionsDisabled =
    sampleMutation.isPending ||
    deleteMutation.isPending ||
    archiveMutation.isPending ||
    unarchiveMutation.isPending;

  function handleAddSamples() {
    if (
      sampleMutation.isPending ||
      !tryAcquirePresentationLock(presentationLock)
    )
      return;
    sampleMutation.mutate();
  }

  function handleImportConvention() {
    if (
      sampleMutation.isPending ||
      !tryAcquirePresentationLock(presentationLock)
    )
      return;
    router.push("/convention/new/import");
  }

  function handleFindConvention() {
    if (
      sampleMutation.isPending ||
      !tryAcquirePresentationLock(presentationLock)
    )
      return;
    router.push("/convention/find");
  }

  function handleCreateConvention() {
    if (
      sampleMutation.isPending ||
      !tryAcquirePresentationLock(presentationLock)
    )
      return;
    router.push("/convention/create");
  }

  function handleOpenConvention(id: string) {
    if (
      sampleMutation.isPending ||
      !tryAcquirePresentationLock(presentationLock)
    )
      return;
    router.push(`/convention/${id}`);
  }

  function confirmDeleteConvention(convention: Convention) {
    if (deleteMutation.isPending) return;
    Alert.alert(
      t("home.delete.title", { name: convention.name }),
      t("home.delete.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate({
              id: convention.id,
              name: convention.name,
            }),
        },
      ],
    );
  }

  function handleConventionAction(
    convention: Convention,
    actionId: ConventionRowActionId,
  ) {
    // Recheck after the menu opens: pending writes can change its availability.
    const action = getRowContent(convention).actions.find(
      (candidate) => candidate.id === actionId,
    );
    if (!action || action.disabled) return;

    switch (action.id) {
      case "edit":
        if (!tryAcquirePresentationLock(presentationLock)) return;
        router.push(`/convention/${convention.id}/edit`);
        break;
      case "archive":
        archiveMutation.mutate(convention.id);
        break;
      case "unarchive":
        unarchiveMutation.mutate(convention.id);
        break;
      case "delete":
        confirmDeleteConvention(convention);
        break;
    }
  }

  // Stable across renders so the SwiftUI Host's child tree only re-diffs when
  // an input actually changed — an inline closure here rebuilt every row on
  // every render and cancelled in-progress swipe actions.
  const getRowContent = useCallback(
    (item: Convention) => {
      const start = formatConventionDate(item.startDate, locale);
      const end = formatConventionDate(item.endDate, locale);
      const status = conventionStatusAt(item, now, deviceTimeZone);
      const daysUntil = conventionDaysUntil(item, now, deviceTimeZone);

      return {
        name: item.name,
        dateRange: t("home.dateRange", { start, end }),
        status,
        statusLabel:
          status !== "upcoming"
            ? t(status === "ended" ? "home.past" : "home.active")
            : daysUntil < 1
              ? t("home.countdown.today")
              : daysUntil === 1
                ? t("home.countdown.tomorrow")
                : t("home.countdown.days", { count: daysUntil }),
        moreAccessibilityLabel: t("home.moreActions", {
          name: item.name,
        }),
        canUnarchive: canUnarchive(item, now, deviceTimeZone),
        actions: conventionRowActions(
          {
            archived: Boolean(item.archivedAt),
            ended: status === "ended",
            canUnarchive: canUnarchive(item, now, deviceTimeZone),
            disabled: rowActionsDisabled,
          },
          {
            edit: t("common.edit"),
            archive: t("common.archive"),
            unarchive: t("common.unarchive"),
            delete: t("common.delete"),
          },
        ),
      };
    },
    [locale, now, rowActionsDisabled, t],
  );

  const showLoading = useDelayedLoading(isLoading || (isError && isFetching));

  const content =
    isLoading || (isError && isFetching) ? (
      showLoading ? (
        <SkeletonUnderHeader>
          <ConventionListSkeleton />
        </SkeletonUnderHeader>
      ) : (
        <View className="flex-1 bg-background" />
      )
    ) : isError ? (
      <View className="flex-1 bg-background">
        <EmptyState
          icon={ERROR_ICON}
          title={t("common.error")}
          subtitle={t("home.loadError")}
          ctaLabel={t("common.retry")}
          onCta={() => {
            void refetch();
          }}
        />
      </View>
    ) : conventions.length === 0 ? (
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        alwaysBounceVertical={false}
        bounces={fontScale > 1.2}
        scrollEnabled={showSamples || fontScale > 1.2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: 48,
          paddingBottom: 24,
        }}
      >
        <ConventionEmptyState
          title={t("home.empty.title")}
          subtitle={t("home.empty.subtitle")}
          createLabel={t("home.empty.cta")}
          findLabel={t("home.find")}
          onFind={handleFindConvention}
          onCreate={handleCreateConvention}
          importLabel={t("convention.importSchedule")}
          onImport={handleImportConvention}
          onAddSamples={showSamples ? handleAddSamples : undefined}
          addingSamples={sampleMutation.isPending}
        />
      </ScrollView>
    ) : (
      <ConventionList
        data={currentConventions}
        archivedData={archivedConventions}
        archiveExpanded={archiveExpanded}
        archiveLabel={t("home.archive.title", {
          count: archivedConventions.length,
        })}
        archiveActionLabel={t(
          archiveExpanded ? "home.archive.hide" : "home.archive.show",
        )}
        currentEmptyLabel={t("home.archive.noCurrent")}
        onToggleArchive={() => setArchiveExpanded((expanded) => !expanded)}
        deleteLabel={t("common.delete")}
        onDelete={(item) => handleConventionAction(item, "delete")}
        archiveItemLabel={t("common.archive")}
        onArchive={(item) => handleConventionAction(item, "archive")}
        unarchiveItemLabel={t("common.unarchive")}
        onUnarchive={(item) => handleConventionAction(item, "unarchive")}
        onAction={handleConventionAction}
        onOpen={(item) => handleOpenConvention(item.id)}
        getRowContent={getRowContent}
      />
    );

  return (
    <>
      {content}

      {!isLoading && !isError && conventions.length > 0 ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon={
              process.env.EXPO_OS === "ios" ? "arrow.up.arrow.down" : SortIcon
            }
            accessibilityLabel={t("home.sortBy")}
            title={t("home.sortBy")}
          >
            <Stack.Toolbar.MenuAction
              isOn={sort === "upcoming"}
              onPress={() => setSort("upcoming")}
            >
              {t("home.sort.upcoming")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={sort === "name"}
              onPress={() => setSort("name")}
            >
              {t("home.sort.name")}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu
            icon={process.env.EXPO_OS === "ios" ? "plus" : AddIcon}
            accessibilityLabel={t("home.addConvention")}
          >
            <Stack.Toolbar.MenuAction
              icon={
                process.env.EXPO_OS === "ios" ? "magnifyingglass" : SearchIcon
              }
              onPress={handleFindConvention}
            >
              {t("home.find")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon={
                process.env.EXPO_OS === "ios"
                  ? "calendar.badge.plus"
                  : EditCalendarIcon
              }
              onPress={handleCreateConvention}
            >
              {t("convention.create")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon={
                process.env.EXPO_OS === "ios"
                  ? "square.and.arrow.down"
                  : DownloadIcon
              }
              onPress={handleImportConvention}
            >
              {t("convention.importSchedule")}
            </Stack.Toolbar.MenuAction>
            {showSamples ? (
              <Stack.Toolbar.MenuAction
                onPress={handleAddSamples}
                disabled={sampleMutation.isPending}
              >
                {sampleMutation.isPending
                  ? "Adding samples…"
                  : "Add sample conventions"}
              </Stack.Toolbar.MenuAction>
            ) : null}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
