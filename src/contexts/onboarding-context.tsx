import { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_STORAGE_KEY } from "@/lib/constants";

export interface OnboardingContextValue {
  isComplete: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(
  null,
);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).then((value) => {
      setIsComplete(value === "true");
      setIsLoading(false);
    });
  }, []);

  async function completeOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setIsComplete(true);
  }

  async function resetOnboarding() {
    await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setIsComplete(false);
  }

  return (
    <OnboardingContext.Provider
      value={{ isComplete, isLoading, completeOnboarding, resetOnboarding }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
