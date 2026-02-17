import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { PawPrint } from "@/lib/icons";
import { OnboardingSlide } from "@/components/onboarding-slide";
import { Button } from "@/components/ui/button";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <OnboardingSlide
      icon={
        <View className="h-24 w-24 items-center justify-center rounded-3xl bg-primary">
          <PawPrint size={48} color="#ffffff" />
        </View>
      }
      title="ConPaws"
      description="Your furry convention companion. Track schedules, discover events, and never miss a moment."
    >
      <Button onPress={() => router.push("/(onboarding)/features")}>
        Get Started
      </Button>
    </OnboardingSlide>
  );
}
