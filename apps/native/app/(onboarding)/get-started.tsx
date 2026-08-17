import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, SafeView, Separator, Text } from "@/components/ui";

export default function GetStartedScreen() {
  const { t } = useTranslation();

  return (
    <SafeView>
      <View className="flex-1 items-center justify-center px-6 gap-6">
        <View className="items-center gap-2">
          <Text variant="h2" className="text-center">
            {t("onboarding.getStarted.title")}
          </Text>
          <Text variant="caption" className="text-center">
            {t("onboarding.getStarted.subtitle")}
          </Text>
        </View>
        <View className="w-full gap-3">
          <Button
            variant="default"
            size="lg"
            onPress={() => {}}
            className="w-full"
          >
            {t("onboarding.getStarted.signInWithApple")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onPress={() => {}}
            className="w-full"
          >
            {t("onboarding.getStarted.signInWithGoogle")}
          </Button>
        </View>
        <Separator className="w-full" />
        <Button
          variant="ghost"
          size="md"
          onPress={() => router.push("/(onboarding)/complete")}
        >
          {t("onboarding.getStarted.skipForNow")}
        </Button>
      </View>
      <View className="px-6 pb-8">
        <Text variant="caption" className="text-center">
          {t("onboarding.getStarted.legal")}
        </Text>
      </View>
    </SafeView>
  );
}
