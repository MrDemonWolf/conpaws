import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";

export default function CompleteScreen() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  async function handleComplete() {
    await completeOnboarding();
    router.replace("/(tabs)");
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-8 dark:bg-black">
      <Text className="text-6xl">🎉</Text>
      <Text className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
        You&apos;re all set!
      </Text>
      <Text className="mt-3 text-center text-gray-500 dark:text-gray-400">
        Start adding conventions and building your schedule.
      </Text>

      <View className="mt-12 w-full">
        <Button onPress={handleComplete}>Let&apos;s Go!</Button>
      </View>
    </View>
  );
}
