import AddIcon from "@expo/material-symbols/add.xml";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import { ConventionCard } from "@/components/ConventionCard";
import { EmptyState, LoadingSpinner, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";

export default function HomeScreen() {
  const { t } = useTranslation();

  const { data: conventions = [], isLoading } = useQuery({
    queryKey: ["conventions"],
    queryFn: conventionsRepo.getAll,
  });

  function handleAddConvention() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        <View className="flex-1 bg-background">
          <EmptyState
            icon={<Text className="text-5xl">🐾</Text>}
            title={t("home.empty.title")}
            subtitle={t("home.empty.subtitle")}
            ctaLabel={t("home.empty.cta")}
            onCta={handleAddConvention}
          />
        </View>
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/convention/${item.id}`);
              }}
            />
          )}
        />
      )}
    </>
  );
}
