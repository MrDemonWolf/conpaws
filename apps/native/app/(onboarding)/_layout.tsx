import { Stack } from "expo-router";
import { ScreenErrorFallback } from "@/lib/error-fallback";

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

// A throw in this layout itself cannot reach the per-screen boundary the root
// layout provides, so it needs its own. Leaf screens under it are already
// covered and keep their chrome.
export const ErrorBoundary = ScreenErrorFallback;
