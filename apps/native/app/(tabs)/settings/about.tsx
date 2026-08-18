import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Github, Globe, Mail, MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { Separator, Text } from "@/components/ui";

interface LinkRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

function LinkRow({ icon, label, onPress }: LinkRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className="flex-row items-center gap-3 py-3.5 active:opacity-70"
    >
      {icon}
      <Text variant="body" className="text-primary flex-1">
        {label}
      </Text>
    </Pressable>
  );
}

export default function AboutScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#18B7F2" : "#006F91";
  const version = Constants.expoConfig?.version ?? "0.0.0";

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Logo + Name */}
      <View className="items-center gap-4 py-10 px-6">
        <Image
          source={require("../../../assets/images/splash-icon.png")}
          className="h-24 w-24"
          resizeMode="contain"
          accessible={false}
        />
        <View className="items-center gap-1">
          <Text variant="h2">ConPaws</Text>
          <Text variant="caption" className="text-muted-foreground">
            Your furry convention companion
          </Text>
        </View>
        <View className="bg-card px-4 py-1.5 rounded-full">
          <Text variant="caption">{t("common.version", { version })}</Text>
        </View>
      </View>

      <Separator className="mx-6 mb-2" />

      {/* Links */}
      <View className="px-6">
        <LinkRow
          icon={<Github size={20} color={iconColor} />}
          label="GitHub (Open Source)"
          onPress={() =>
            WebBrowser.openBrowserAsync(
              "https://github.com/mrdemonwolf/conpaws",
            )
          }
        />
        <Separator />
        <LinkRow
          icon={<Globe size={20} color={iconColor} />}
          label="mrdemonwolf.com"
          onPress={() => WebBrowser.openBrowserAsync("https://mrdemonwolf.com")}
        />
        <Separator />
        <LinkRow
          icon={<Mail size={20} color={iconColor} />}
          label="hello@conpaws.com"
          onPress={() => Linking.openURL("mailto:hello@conpaws.com")}
        />
        <Separator />
        <LinkRow
          icon={<MessageCircle size={20} color={iconColor} />}
          label="Join our Discord"
          onPress={() =>
            WebBrowser.openBrowserAsync("https://discord.gg/conpaws")
          }
        />
      </View>

      <View className="py-8 items-center px-6">
        <Text variant="caption" className="text-center text-muted-foreground">
          Made with ❤️ for the furry community
        </Text>
        <Text
          variant="caption"
          className="text-center text-muted-foreground mt-1"
        >
          © 2026 ConPaws. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}
