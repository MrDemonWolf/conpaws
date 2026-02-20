import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface OnboardingContextValue {
  isOnboardingComplete: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  isOnboardingComplete: false,
  isLoading: true,
  completeOnboarding: async () => {},
  resetOnboarding: async () => {},
});

const STORAGE_KEY = "onboarding_complete";

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      setIsOnboardingComplete(value === "true");
      setIsLoading(false);
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "true");
    setIsOnboardingComplete(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setIsOnboardingComplete(false);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        isLoading,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
