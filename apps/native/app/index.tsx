import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { reportError } from "@/lib/error-reporting";
import {
  getCachedOnboardingFlag,
  hasCompletedOnboarding,
} from "@/lib/onboarding-storage";

export default function Index() {
  // The launch bootstrap already read the flag before the splash screen hid,
  // so in the normal path this is a synchronous answer and the redirect
  // happens on the first render — no blank frame. The async read below only
  // matters when the cache is cold (fast refresh, bootstrap error path).
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(
    getCachedOnboardingFlag,
  );

  useEffect(() => {
    if (hasOnboarded !== null) return;
    hasCompletedOnboarding()
      .then(setHasOnboarded)
      .catch((error) => {
        // Onboarding again is the safe default, but a storage layer that
        // cannot be read is why the app appears to reset itself every launch.
        reportError(error, { scope: "onboarding.readFlag" });
        setHasOnboarded(false);
      });
  }, [hasOnboarded]);

  if (hasOnboarded === null) return <View className="flex-1 bg-background" />;
  if (hasOnboarded) return <Redirect href="/(tabs)/(home)" />;
  return <Redirect href="/(onboarding)/welcome" />;
}
