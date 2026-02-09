import "../global.css";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { AuthProvider } from "@/contexts/auth-context";
import { OnboardingProvider } from "@/contexts/onboarding-context";
import { PremiumProvider } from "@/contexts/premium-context";
import { useOnboarding } from "@/hooks/use-onboarding";

function RootNavigator() {
  const { isComplete, isLoading } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inOnboarding = segments[0] === "(onboarding)";

    if (!isComplete && !inOnboarding) {
      router.replace("/(onboarding)/welcome");
    } else if (isComplete && inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [isComplete, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <OnboardingProvider>
        <AuthProvider>
          <PremiumProvider>
            <RootNavigator />
          </PremiumProvider>
        </AuthProvider>
      </OnboardingProvider>
    </ThemeProvider>
  );
}
