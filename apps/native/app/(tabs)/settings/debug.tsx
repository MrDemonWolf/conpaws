import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { OnboardingButton } from "@/components/OnboardingButton";
import { Card, Text } from "@/components/ui";
import { developerToolsEnabled } from "@/lib/developer-tools";

export default function DebugScreen() {
  const enabled = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );

  if (!enabled) return <Redirect href="/(tabs)/settings" />;

  function replayOnboarding() {
    Alert.alert(
      "Replay Onboarding?",
      "This only resets the onboarding flag. Your conventions and settings stay unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replay",
          onPress: async () => {
            await AsyncStorage.removeItem("hasCompletedOnboarding");
            router.replace("/(onboarding)/welcome");
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16 }}
    >
      <Card className="gap-3 p-4">
        <View className="gap-1">
          <Text variant="h3">Onboarding</Text>
          <Text variant="caption" className="text-muted-foreground">
            Start the first-run flow without deleting app data.
          </Text>
        </View>
        <OnboardingButton
          label="Replay Onboarding"
          onPress={replayOnboarding}
        />
      </Card>
    </ScrollView>
  );
}
