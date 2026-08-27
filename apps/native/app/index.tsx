import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { reportError } from "@/lib/error-reporting";
import { hasCompletedOnboarding } from "@/lib/onboarding-storage";

export default function Index() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasCompletedOnboarding()
      .then(setHasOnboarded)
      .catch((error) => {
        // Onboarding again is the safe default, but a storage layer that
        // cannot be read is why the app appears to reset itself every launch.
        reportError(error, { scope: "onboarding.readFlag" });
        setHasOnboarded(false);
      });
  }, []);

  if (hasOnboarded === null) return <View className="flex-1 bg-background" />;
  if (hasOnboarded) return <Redirect href="/(tabs)/(home)" />;
  return <Redirect href="/(onboarding)/welcome" />;
}
