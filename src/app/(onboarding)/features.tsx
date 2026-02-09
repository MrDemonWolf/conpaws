import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/button";

const features = [
  {
    emoji: "📅",
    title: "Convention Schedules",
    description: "Import and manage panel schedules with iCal",
  },
  {
    emoji: "✨",
    title: "Custom Events",
    description: "Add meetups, dinners, and personal events",
  },
  {
    emoji: "📴",
    title: "Works Offline",
    description: "All core features work without internet",
  },
];

export default function FeaturesScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center bg-white px-8 dark:bg-black">
      <Text className="text-2xl font-bold text-gray-900 dark:text-white">
        Everything you need for cons
      </Text>

      <View className="mt-8 gap-6">
        {features.map((feature) => (
          <View key={feature.title} className="flex-row items-start gap-4">
            <Text className="text-3xl">{feature.emoji}</Text>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                {feature.title}
              </Text>
              <Text className="mt-1 text-gray-500 dark:text-gray-400">
                {feature.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mt-12 w-full gap-3">
        <Button onPress={() => router.push("/(onboarding)/auth")}>
          Continue
        </Button>
        <Button
          variant="ghost"
          onPress={() => router.push("/(onboarding)/complete")}
        >
          Skip for now
        </Button>
      </View>
    </View>
  );
}
