import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/button";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-white px-8 dark:bg-black">
      <Text className="text-6xl">🐾</Text>
      <Text className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
        Welcome to ConPaws
      </Text>
      <Text className="mt-3 text-center text-lg text-gray-500 dark:text-gray-400">
        Your furry convention companion. Manage schedules, find events, and
        connect with friends.
      </Text>

      <View className="mt-12 w-full gap-3">
        <Button onPress={() => router.push("/(onboarding)/features")}>
          Get Started
        </Button>
      </View>
    </View>
  );
}
