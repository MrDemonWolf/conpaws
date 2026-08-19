import AddIcon from "@expo/material-symbols/add.xml";
import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import EditCalendarIcon from "@expo/material-symbols/edit_calendar.xml";
import { Icon } from "@expo/ui";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, View } from "react-native";
import { ConventionCard } from "@/components/ConventionCard";
import { EmptyState, LoadingSpinner } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";

const EMPTY_ICON = Icon.select({
  ios: "calendar.badge.plus",
  android: CalendarAddIcon,
});

export default function HomeScreen() {
  const { t } = useTranslation();

  const { data: conventions = [], isLoading } = useQuery({
    queryKey: ["conventions"],
    queryFn: conventionsRepo.getAll,
  });

  function handleImportConvention() {
    router.push("/convention/new/import");
  }

  function handleCreateConvention() {
    router.push("/convention/create");
  }

  return (
    <>
      {!isLoading && conventions.length > 0 ? (
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

      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-background">
          <LoadingSpinner />
        </View>
      ) : conventions.length === 0 ? (
        <ScrollView
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingTop: 24,
            paddingBottom: 144,
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
          className="bg-background"
          contentInsetAdjustmentBehavior="automatic"
          data={conventions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 12,
          }}
          renderItem={({ item }) => (
            <ConventionCard
              name={item.name}
              startDate={item.startDate}
              endDate={item.endDate}
              status={item.status}
              onPress={() => {
                router.push(`/convention/${item.id}`);
              }}
            />
          )}
        />
      )}
    </>
  );
}
