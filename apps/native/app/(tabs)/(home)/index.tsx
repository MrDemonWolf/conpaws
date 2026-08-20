import AddIcon from "@expo/material-symbols/add.xml";
import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import EditCalendarIcon from "@expo/material-symbols/edit_calendar.xml";
import SortIcon from "@expo/material-symbols/sort.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Host, Icon } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useFocusEffect } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { ConventionList } from "@/components/ConventionList";
import { Button, EmptyState, LoadingSpinner, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention } from "@/db/schema";
import {
  type ConventionSort,
  conventionDaysUntil,
  conventionStatusAt,
  partitionConventions,
  sortConventions,
} from "@/lib/convention-list";
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
  const colorScheme = useColorScheme();
  const { colors } = useTheme();

  return (
    <View
      className="mx-4 my-auto gap-6 rounded-3xl border border-border bg-card px-6 py-8"
      style={{ borderCurve: "continuous" }}
    >
      <View className="items-center gap-4">
        <View
          className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
          style={{ borderCurve: "continuous" }}
        >
          <Host
            colorScheme={colorScheme === "dark" ? "dark" : "light"}
            matchContents
            pointerEvents="none"
          >
            <Icon name={EMPTY_ICON} size={38} color={colors.primary} />
          </Host>
        </View>
        <View className="items-center gap-2">
          <Text variant="h2" className="text-center">
            {title}
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            {subtitle}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Button size="lg" className="w-full" onPress={onCreate}>
          {createLabel}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onPress={onImport}
        >
          {importLabel}
        </Button>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ConventionSort>("upcoming");
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const presentationLock = useRef(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { date: dateFormatter, names: nameCollator } = localeFormatters(locale);
  const deviceTimeZone = DEVICE_TIME_ZONE;

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
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
  const now = new Date();
  const sortedConventions = sortConventions(
    conventions,
    sort,
    nameCollator.compare,
    now,
    deviceTimeZone,
  );
  const { current: currentConventions, archived: archivedConventions } =
    partitionConventions(sortedConventions, now, deviceTimeZone);

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

  const content =
    isLoading || (isError && isFetching) ? (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingSpinner />
      </View>
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
        onOpen={(item) => handleOpenConvention(item.id)}
        getRowContent={(item) => {
          const start = dateFormatter.format(
            new Date(`${item.startDate}T12:00:00`),
          );
          const end = dateFormatter.format(
            new Date(`${item.endDate}T12:00:00`),
          );
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
          };
        }}
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
