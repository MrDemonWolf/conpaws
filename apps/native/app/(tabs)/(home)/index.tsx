import AddIcon from "@expo/material-symbols/add.xml";
import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import EditCalendarIcon from "@expo/material-symbols/edit_calendar.xml";
import SortIcon from "@expo/material-symbols/sort.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ConventionListSkeleton, EmptyState } from "@/components/ui";
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
import { currentLocale } from "@/lib/i18n";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
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
const localeFormatterCache = new Map<
  string,
  {
    date: Intl.DateTimeFormat;
    names: Intl.Collator;
  }
>();

function localeFormatters(locale: string) {
  const cached = localeFormatterCache.get(locale);
  if (cached) return cached;

  // ponytail: supported locales are finite; keep expensive Intl formatters per locale.
  const formatters = {
    date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    names: new Intl.Collator(locale, { sensitivity: "base" }),
  };
  localeFormatterCache.set(locale, formatters);
  return formatters;
}

interface ConventionEmptyStateProps {
  title: string;
  subtitle: string;
  createLabel: string;
  importLabel: string;
  onCreate: () => void;
  onImport: () => void;
}

function ConventionEmptyState({
  title,
  subtitle,
  createLabel,
  importLabel,
  onCreate,
  onImport,
}: ConventionEmptyStateProps) {
  return (
    // Import is primary: it is the path that produces a populated schedule.
    // Create used to be primary and led straight to a second empty state —
    // and the last onboarding screen already promotes Import, so the two
    // surfaces now agree about what a new user should do first.
    <EmptyState
      icon={EMPTY_ICON}
      title={title}
      subtitle={subtitle}
      ctaLabel={importLabel}
      onCta={onImport}
      secondaryCtaLabel={createLabel}
      onSecondaryCta={onCreate}
      secondaryCtaVariant="outlined"
      actionsInline
    />
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ConventionSort>("upcoming");
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const presentationLock = useRef(0);
  const locale = currentLocale();
  const { date: dateFormatter, names: nameCollator } = localeFormatters(locale);
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
      AccessibilityInfo.announceForAccessibility(
        t("home.delete.success", { name }),
      );
    },
    onError: () => {
      Alert.alert(t("home.delete.errorTitle"), t("home.delete.errorMessage"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: conventionsRepo.archive,
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

  function handleImportConvention() {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push("/convention/new/import");
  }

  function handleCreateConvention() {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push("/convention/create");
  }

  function handleOpenConvention(id: string) {
    if (!tryAcquirePresentationLock(presentationLock)) return;
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

  function showConventionActions(convention: Convention) {
    // Archived rows swap Archive for Unarchive — when unarchiving would
    // actually move the row (see canUnarchive). Ended conventions get
    // neither: re-archiving is a timestamp rewrite and unarchiving a no-op.
    const archiveAction = convention.archivedAt
      ? canUnarchive(convention, now, deviceTimeZone)
        ? {
            text: t("common.unarchive"),
            onPress: () => unarchiveMutation.mutate(convention.id),
          }
        : null
      : {
          text: t("common.archive"),
          onPress: () => archiveMutation.mutate(convention.id),
        };

    Alert.alert(convention.name, undefined, [
      {
        text: t("common.edit"),
        onPress: () => {
          if (!tryAcquirePresentationLock(presentationLock)) return;
          router.push(`/convention/${convention.id}/edit`);
        },
      },
      ...(archiveAction ? [archiveAction] : []),
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => confirmDeleteConvention(convention),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  // Stable across renders so the SwiftUI Host's child tree only re-diffs when
  // an input actually changed — an inline closure here rebuilt every row on
  // every render and cancelled in-progress swipe actions.
  const getRowContent = useCallback(
    (item: Convention) => {
      const start = dateFormatter.format(
        new Date(`${item.startDate}T12:00:00`),
      );
      const end = dateFormatter.format(new Date(`${item.endDate}T12:00:00`));
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
      };
    },
    [dateFormatter, now, t],
  );

  const showLoading = useDelayedLoading(isLoading || (isError && isFetching));

  const content =
    isLoading || (isError && isFetching) ? (
      showLoading ? (
        <ConventionListSkeleton />
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
        scrollEnabled={fontScale > 1.2}
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
          onCreate={handleCreateConvention}
          importLabel={t("convention.importSchedule")}
          onImport={handleImportConvention}
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
        onDelete={confirmDeleteConvention}
        archiveItemLabel={t("common.archive")}
        onArchive={(item) => archiveMutation.mutate(item.id)}
        unarchiveItemLabel={t("common.unarchive")}
        onUnarchive={(item) => unarchiveMutation.mutate(item.id)}
        onOpenActions={showConventionActions}
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
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
