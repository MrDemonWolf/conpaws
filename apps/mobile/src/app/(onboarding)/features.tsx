import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, Share2, Shield } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useColorScheme } from "@/lib/useColorScheme";

const features = [
  {
    icon: Calendar,
    title: "Track Schedules",
    description: "Import convention schedules and build your personal agenda.",
  },
  {
    icon: Share2,
    title: "Share with Friends",
    description: "Export and share your schedule with fellow con-goers.",
  },
  {
    icon: Shield,
    title: "Your Data, Your Device",
    description: "Everything stays on your phone. No account required.",
  },
];

export default function FeaturesScreen() {
  const router = useRouter();
  const { isDark } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-8">
        <Text className="mb-8 text-center text-2xl font-bold text-foreground">
          What you can do
        </Text>
        <View className="gap-4">
          {features.map((feature) => (
            <Card key={feature.title} className="flex-row items-center gap-4 p-4">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <feature.icon
                  size={24}
                  color={isDark ? "#8b5cf6" : "#6D28D9"}
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  {feature.title}
                </Text>
                <Text className="mt-0.5 text-sm text-muted-foreground">
                  {feature.description}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </View>
      <View className="px-8 pb-8">
        <Button onPress={() => router.push("/(onboarding)/auth")}>
          Continue
        </Button>
      </View>
    </SafeAreaView>
  );
}
