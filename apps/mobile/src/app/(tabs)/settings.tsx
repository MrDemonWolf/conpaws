import { Text, ScrollView, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Moon,
  Sun,
  Info,
  Download,
  Upload,
  ExternalLink,
  Trash2,
} from "@/lib/icons";
import { useColorScheme } from "@/lib/useColorScheme";
import { useOnboarding } from "@/contexts/onboarding-context";
import { SettingsGroup } from "@/components/settings-group";
import { SettingsItem } from "@/components/settings-item";
import { LEGAL_URLS, APP_VERSION } from "@/lib/constants";
import { useExportData, useImportData } from "@/hooks/use-data-transfer";

export default function SettingsScreen() {
  const router = useRouter();
  const { preference, setPreference, isDark } = useColorScheme();
  const { resetOnboarding } = useOnboarding();
  const { exportData } = useExportData();
  const { importData } = useImportData();

  const handleResetOnboarding = () => {
    Alert.alert(
      "Reset Onboarding",
      "This will show the onboarding screens again on next launch.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetOnboarding();
            router.replace("/(onboarding)/welcome");
          },
        },
      ],
    );
  };

  const themeLabel =
    preference === "system"
      ? "System"
      : preference === "dark"
        ? "Dark"
        : "Light";

  const cycleTheme = () => {
    const next =
      preference === "system" ? "light" : preference === "light" ? "dark" : "system";
    setPreference(next);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="px-6 pb-4 pt-2 text-2xl font-bold text-foreground">
          Settings
        </Text>

        <SettingsGroup title="APP">
          <SettingsItem
            icon={isDark ? Moon : Sun}
            label="Theme"
            value={themeLabel}
            onPress={cycleTheme}
          />
          <SettingsItem
            icon={Info}
            label="About"
            onPress={() => router.push("/settings/about")}
          />
        </SettingsGroup>

        <SettingsGroup title="DATA">
          <SettingsItem
            icon={Upload}
            label="Export My Data"
            onPress={exportData}
          />
          <SettingsItem
            icon={Download}
            label="Import Data"
            onPress={importData}
          />
        </SettingsGroup>

        <SettingsGroup title="LEGAL">
          <SettingsItem
            icon={ExternalLink}
            label="Privacy Policy"
            onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
          />
          <SettingsItem
            icon={ExternalLink}
            label="Terms of Service"
            onPress={() => Linking.openURL(LEGAL_URLS.terms)}
          />
        </SettingsGroup>

        <SettingsGroup title="DANGER ZONE">
          <SettingsItem
            icon={Trash2}
            label="Reset Onboarding"
            onPress={handleResetOnboarding}
            destructive
          />
        </SettingsGroup>

        <Text className="mt-4 text-center text-xs text-muted-foreground">
          ConPaws v{APP_VERSION}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
