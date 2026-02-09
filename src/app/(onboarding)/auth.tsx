import { Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithGoogle, signInWithApple } = useAuth();

  async function handleGoogleSignIn() {
    await signInWithGoogle();
    router.push("/(onboarding)/complete");
  }

  async function handleAppleSignIn() {
    await signInWithApple();
    router.push("/(onboarding)/complete");
  }

  return (
    <View className="flex-1 justify-center bg-white px-8 dark:bg-black">
      <Text className="text-2xl font-bold text-gray-900 dark:text-white">
        Create your account
      </Text>
      <Text className="mt-2 text-gray-500 dark:text-gray-400">
        Sign in to sync your profile and conventions across devices. It&apos;s
        free!
      </Text>

      <View className="mt-8 gap-3">
        {Platform.OS === "ios" && (
          <Button variant="secondary" onPress={handleAppleSignIn}>
            Continue with Apple
          </Button>
        )}
        <Button variant="secondary" onPress={handleGoogleSignIn}>
          Continue with Google
        </Button>
      </View>

      <View className="mt-6">
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
