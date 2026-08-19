import AddIcon from "@expo/material-symbols/add.xml";
import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
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

  function handleAddConvention() {
    router.push("/convention/new/import");
  }

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={process.env.EXPO_OS === "ios" ? "plus" : AddIcon}
          onPress={handleAddConvention}
          accessibilityLabel={t("home.empty.cta")}
        >
          {t("home.empty.cta")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-background">
          <LoadingSpinner />
        </View>
      ) : conventions.length === 0 ? (
        <ScrollView
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <EmptyState
            icon={EMPTY_ICON}
            title={t("home.empty.title")}
            subtitle={t("home.empty.subtitle")}
            ctaLabel={t("home.empty.cta")}
            onCta={handleAddConvention}
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
