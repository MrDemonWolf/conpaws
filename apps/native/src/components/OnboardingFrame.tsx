import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { ReadableColumn, SafeView } from "@/components/ui";
import { useContentWidth } from "@/hooks/useContentWidth";
import { ACTIONS_MAX, ONBOARDING_MAX } from "@/lib/content-width";

export function OnboardingFrame({
  step,
  children,
  actions,
}: {
  step: 1 | 2 | 3;
  children: ReactNode;
  actions: ReactNode;
}) {
  // A wide window centres the block vertically as well; on a phone, or a
  // window too short for it, the content stays top-aligned and scrolls.
  const { roomy } = useContentWidth();

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
          ...(roomy ? { justifyContent: "center" as const } : null),
        }}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <ReadableColumn max={ONBOARDING_MAX} gutter={false}>
          <OnboardingProgress step={step} />
          <View className="gap-5 py-6">{children}</View>
        </ReadableColumn>
      </ScrollView>
      {/* The buttons fill this bar, so capping it narrows them too. */}
      <ReadableColumn max={ACTIONS_MAX} className="gap-1 px-4 pt-1 pb-2">
        {actions}
      </ReadableColumn>
    </SafeView>
  );
}
