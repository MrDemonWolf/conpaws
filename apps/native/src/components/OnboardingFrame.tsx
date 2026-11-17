import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { SafeView } from "@/components/ui";

export function OnboardingFrame({
  step,
  children,
  actions,
}: {
  step: 1 | 2 | 3;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <SafeView className="overflow-hidden bg-background">
      <ScrollView
        className="flex-1"
        alwaysBounceVertical={false}
        bounces={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
        }}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingProgress step={step} />
        <View className="gap-5 py-6">{children}</View>
      </ScrollView>
      <View className="gap-1 px-4 pt-1 pb-2">{actions}</View>
    </SafeView>
  );
}
