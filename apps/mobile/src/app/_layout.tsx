import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ColorSchemeProvider } from "@/lib/useColorScheme";
import { OnboardingProvider, useOnboarding } from "@/contexts/onboarding-context";
import { initDatabase } from "@/db/client";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { isOnboardingComplete, isLoading } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inOnboarding = segments[0] === "(onboarding)";

    if (!isOnboardingComplete && !inOnboarding) {
      router.replace("/(onboarding)/welcome");
    } else if (isOnboardingComplete && inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [isOnboardingComplete, isLoading, segments]);

  useEffect(() => {
    if (!isLoading) {
      initDatabase().then(() => {
        SplashScreen.hideAsync();
      });
    }
  }, [isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="convention" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ColorSchemeProvider>
        <QueryClientProvider client={queryClient}>
          <OnboardingProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </OnboardingProvider>
        </QueryClientProvider>
      </ColorSchemeProvider>
    </SafeAreaProvider>
  );
}
