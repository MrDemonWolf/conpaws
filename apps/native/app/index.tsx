import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("hasCompletedOnboarding").then((value) => {
      setHasOnboarded(!!value);
    });
  }, []);

  if (hasOnboarded === null) return <View className="flex-1 bg-background" />;
  if (hasOnboarded) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(onboarding)/welcome" />;
}
