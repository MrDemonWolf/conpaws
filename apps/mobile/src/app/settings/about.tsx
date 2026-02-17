import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { PawPrint } from "@/lib/icons";
import { APP_NAME, APP_VERSION, APP_TAGLINE } from "@/lib/constants";
import { useColorScheme } from "@/lib/useColorScheme";

export default function AboutScreen() {
  const { isDark } = useColorScheme();

  return (
    <>
      <Stack.Screen options={{ title: "About" }} />
      <View className="flex-1 items-center justify-center bg-background px-8">
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-3xl bg-primary">
          <PawPrint size={48} color="#ffffff" />
        </View>

        <Text className="text-3xl font-bold text-foreground">{APP_NAME}</Text>
        <Text className="mt-1 text-base text-muted-foreground">
          {APP_TAGLINE}
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Version {APP_VERSION}
        </Text>

        <View className="mt-8 items-center">
          <Text className="text-sm text-muted-foreground">
            Built with care by
          </Text>
          <Text className="mt-0.5 text-base font-semibold text-foreground">
            MrDemonWolf
          </Text>
        </View>
      </View>
    </>
  );
}
