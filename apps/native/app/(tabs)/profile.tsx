import { UserCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge, Button, SafeView, Text } from "@/components/ui";

export default function ProfileScreen() {
  const { t } = useTranslation();

  return (
    <SafeView edges={["top", "bottom"]}>
      <View className="px-4 py-3">
        <Text variant="h2">{t("profile.title")}</Text>
      </View>
      <View className="flex-1 items-center justify-center px-6 gap-8">
        <UserCircle size={80} color="#94A3B8" />
        <View className="items-center gap-2">
          <Text variant="h3">Create an account</Text>
          <Text variant="caption" className="text-center text-muted-foreground">
            Set up your profile and sync your schedule across devices
          </Text>
        </View>

        <View className="w-full gap-3">
          {/* Apple Sign In */}
          <View className="relative">
            <Button variant="default" size="lg" disabled className="w-full">
              {t("profile.signInWithApple")}
            </Button>
            <View className="absolute right-3 top-0 bottom-0 justify-center">
              <Badge variant="upcoming" label="Coming Soon" />
            </View>
          </View>

          {/* Google Sign In */}
          <View className="relative">
            <Button variant="outline" size="lg" disabled className="w-full">
              {t("profile.signInWithGoogle")}
            </Button>
            <View className="absolute right-3 top-0 bottom-0 justify-center">
              <Badge variant="upcoming" label="Coming Soon" />
            </View>
          </View>
        </View>

        <Text variant="caption" className="text-center text-muted-foreground">
          Account sync is coming in Phase 2. Your data is safely stored locally
          for now.
        </Text>
      </View>
    </SafeView>
  );
}
