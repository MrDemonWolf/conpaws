import { View } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "@/lib/icons";
import { OnboardingSlide } from "@/components/onboarding-slide";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/onboarding-context";

export default function CompleteScreen() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  const handleComplete = async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <OnboardingSlide
      icon={
        <View className="h-24 w-24 items-center justify-center rounded-full bg-green-500">
          <Check size={48} color="#ffffff" />
        </View>
      }
      title="You're all set!"
      description="Start by importing a convention schedule or creating one manually."
    >
      <Button onPress={handleComplete}>
        {"Let's Go"}
      </Button>
    </OnboardingSlide>
  );
}
