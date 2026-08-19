import { FieldGroup, Host, ListItem, Button as NativeButton } from "@expo/ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useState } from "react";
import { Alert, useColorScheme } from "react-native";
import {
  BLANK_PREVIEW_CONVENTION_ID,
  PREVIEW_CONVENTION_ID,
} from "@/fixtures/conpaws-preview";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { resetPreviewConventions } from "@/lib/preview-convention";

export default function DebugScreen() {
  const queryClient = useQueryClient();
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const colorScheme = useColorScheme();
  const { colors } = useTheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";
  const appVariant = Constants.expoConfig?.extra?.appVariant;
  const enabled = developerToolsEnabled(__DEV__, appVariant);

  if (!enabled) return <Redirect href="/(tabs)/settings" />;

  function replayOnboarding() {
    Alert.alert(
      "Replay Onboarding?",
      "This only resets the onboarding flag. Your conventions and settings stay unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replay",
          onPress: async () => {
            await AsyncStorage.removeItem("hasCompletedOnboarding");
            router.replace("/(onboarding)/welcome");
          },
        },
      ],
    );
  }

  async function loadPreviewConvention(id: string) {
    setIsLoadingPreview(true);
    try {
      const installed = await resetPreviewConventions(__DEV__, appVariant);
      if (!installed) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conventions"] }),
        queryClient.invalidateQueries({ queryKey: ["convention"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
      router.push(`/convention/${id}`);
    } catch {
      Alert.alert(
        "Preview Con could not be loaded",
        "Your existing conventions were not changed. Try again.",
      );
    } finally {
      setIsLoadingPreview(false);
    }
  }

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section title="Onboarding">
          <ListItem supportingText="Your conventions and settings stay unchanged.">
            Replay the first-run experience
          </ListItem>
          <NativeButton
            label="Replay Onboarding"
            variant="outlined"
            onPress={replayOnboarding}
            style={{ height: 44 }}
          />
        </FieldGroup.Section>

        <FieldGroup.Section title="Preview data" disabled={isLoadingPreview}>
          <ListItem supportingText="Reset a full 200-event schedule and a blank convention for offline previews and tests.">
            ConPaws Preview Cons
          </ListItem>
          <NativeButton
            label={
              isLoadingPreview
                ? "Loading Preview Cons"
                : "Load Full Preview Con"
            }
            onPress={() => loadPreviewConvention(PREVIEW_CONVENTION_ID)}
            disabled={isLoadingPreview}
            testID="debug-load-preview-con"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Load Blank Preview Con"
            onPress={() => loadPreviewConvention(BLANK_PREVIEW_CONVENTION_ID)}
            variant="outlined"
            disabled={isLoadingPreview}
            testID="debug-load-blank-preview-con"
            style={{ height: 44 }}
          />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
