import { useContext } from "react";
import { OnboardingContext } from "@/contexts/onboarding-context";

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
