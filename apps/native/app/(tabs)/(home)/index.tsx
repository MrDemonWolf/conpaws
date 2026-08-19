import AddIcon from "@expo/material-symbols/add.xml";
import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import EditCalendarIcon from "@expo/material-symbols/edit_calendar.xml";
import SortIcon from "@expo/material-symbols/sort.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { ConventionList } from "@/components/ConventionList";
import { EmptyState, LoadingSpinner } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention } from "@/db/schema";
import {
  type ConventionSort,
  conventionStatusAt,
  sortConventions,
} from "@/lib/convention-list";
import { cancelConventionReminders } from "@/services/notifications";

const EMPTY_ICON = Icon.select({
  ios: "calendar.badge.plus",
  android: CalendarAddIcon,
});

const ERROR_ICON = Icon.select({
  ios: "exclamationmark.triangle",
  android: WarningIcon,
});

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ConventionSort>("upcoming");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
      }),
    [locale],
  );
  const nameCollator = useMemo(
    () => new Intl.Collator(locale, { sensitivity: "base" }),
    [locale],
  );
  const deviceTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
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
    router.push("/convention/new/import");
  }

  function handleCreateConvention() {
    router.push("/convention/create");
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
        <EmptyState
          className="flex-none"
          icon={EMPTY_ICON}
          title={t("home.empty.title")}
          subtitle={t("home.empty.subtitle")}
          ctaLabel={t("home.empty.cta")}
          onCta={handleCreateConvention}
          secondaryCtaLabel={t("convention.importSchedule")}
          onSecondaryCta={handleImportConvention}
        />
      </ScrollView>
    ) : (
      <ConventionList
        data={sortedConventions}
        deleteLabel={t("common.delete")}
        onDelete={confirmDeleteConvention}
        onOpen={(item) => router.push(`/convention/${item.id}`)}
        getRowContent={(item) => {
          const start = dateFormatter.format(
            new Date(`${item.startDate}T12:00:00`),
          );
          const end = dateFormatter.format(
            new Date(`${item.endDate}T12:00:00`),
          );
          const status = conventionStatusAt(item, now, deviceTimeZone);

          return {
            name: item.name,
            dateRange: t("home.dateRange", { start, end }),
            status,
            statusLabel: t(status === "ended" ? "home.past" : `home.${status}`),
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
