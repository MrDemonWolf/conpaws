import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function Index() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("hasCompletedOnboarding")
      .then((value) => {
        setHasOnboarded(value === "true");
      })
      .catch(() => {
        setHasOnboarded(false);
      });
  }, []);

  if (hasOnboarded === null) return <View className="flex-1 bg-background" />;
  if (hasOnboarded) return <Redirect href="/(tabs)/(home)" />;
  return <Redirect href="/(onboarding)/welcome" />;
}
