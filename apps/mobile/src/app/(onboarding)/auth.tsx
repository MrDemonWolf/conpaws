import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";

export default function AuthScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-8">
        <Text className="mb-2 text-center text-2xl font-bold text-foreground">
          Create an Account
        </Text>
        <Text className="mb-8 text-center text-base text-muted-foreground">
          Sign in to sync your data across devices. Coming soon!
        </Text>

        <View className="gap-3">
          <Button variant="outline" disabled>
            Continue with Google
          </Button>
          <Button variant="outline" disabled>
            Continue with Apple
          </Button>
        </View>
      </View>

      <View className="px-8 pb-8">
        <Pressable
          onPress={() => router.push("/(onboarding)/complete")}
          className="py-3"
        >
          <Text className="text-center text-base font-medium text-primary">
            Skip for now
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
