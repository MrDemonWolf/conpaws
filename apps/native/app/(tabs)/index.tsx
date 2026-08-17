import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, View } from "react-native";
import { ConventionCard } from "@/components/ConventionCard";
import { EmptyState, LoadingSpinner, SafeView, Text } from "@/components/ui";
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
    <SafeView edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text variant="h2">{t("home.title")}</Text>
        <Pressable
          onPress={handleAddConvention}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center active:opacity-80"
        >
          <Text className="text-primary-foreground text-2xl font-light leading-none">
            +
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner />
        </View>
      ) : conventions.length === 0 ? (
        <EmptyState
          icon={<Text className="text-5xl">🐾</Text>}
          title={t("home.empty.title")}
          subtitle={t("home.empty.subtitle")}
          ctaLabel={t("home.empty.cta")}
          onCta={handleAddConvention}
        />
      ) : (
        <FlatList
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
    </SafeView>
  );
}
