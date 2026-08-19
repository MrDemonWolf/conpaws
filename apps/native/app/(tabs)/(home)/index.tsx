import AddIcon from "@expo/material-symbols/add.xml";
import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import EditCalendarIcon from "@expo/material-symbols/edit_calendar.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, useWindowDimensions, View } from "react-native";
import { ConventionCard } from "@/components/ConventionCard";
import { EmptyState, LoadingSpinner } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";

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
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        dateStyle: "medium",
      }),
    [i18n.language, i18n.resolvedLanguage],
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

  function handleImportConvention() {
    router.push("/convention/new/import");
  }

  function handleCreateConvention() {
    router.push("/convention/create");
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
      <FlatList
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="always"
        alwaysBounceVertical={false}
        data={conventions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
        ItemSeparatorComponent={() => <View className="ml-1 h-px bg-border" />}
        renderItem={({ item }) => {
          const start = dateFormatter.format(
            new Date(`${item.startDate}T12:00:00`),
          );
          const end = dateFormatter.format(
            new Date(`${item.endDate}T12:00:00`),
          );

          return (
            <ConventionCard
              name={item.name}
              dateRange={t("home.dateRange", { start, end })}
              status={item.status}
              statusLabel={t(
                item.status === "ended" ? "home.past" : `home.${item.status}`,
              )}
              onPress={() => {
                router.push(`/convention/${item.id}`);
              }}
            />
          );
        }}
      />
    );

  return (
    <>
      {content}

      {!isLoading && !isError && conventions.length > 0 ? (
        <Stack.Toolbar placement="right">
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
