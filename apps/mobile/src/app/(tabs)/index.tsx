import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Calendar } from "@/lib/icons";
import { useConventions } from "@/hooks/use-conventions";
import { ConventionCard } from "@/components/convention-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";

export default function HomeScreen() {
  const router = useRouter();
  const { data: conventions = [], isLoading } = useConventions();
  const { isDark } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
        <Text className="text-2xl font-bold text-foreground">
          My Conventions
        </Text>
        <View className="flex-row gap-2">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.push("/convention/import")}
          >
            <Calendar size={22} color={isDark ? "#fafaf9" : "#0a0a0a"} />
          </Button>
          <Button
            variant="default"
            size="icon"
            onPress={() => router.push("/convention/new")}
          >
            <Plus size={22} color="#ffffff" />
          </Button>
        </View>
      </View>

      {conventions.length === 0 && !isLoading ? (
        <EmptyState
          icon={<Calendar size={48} color={isDark ? "#a8a29e" : "#78716c"} />}
          title="No conventions yet"
          description="Add your first convention by importing a schedule or creating one manually."
          actionLabel="Add Convention"
          onAction={() => router.push("/convention/new")}
        />
      ) : (
        <FlatList
          data={conventions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/convention/${item.id}`)}
            >
              <ConventionCard convention={item} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
