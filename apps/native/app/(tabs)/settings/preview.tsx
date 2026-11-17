import { FieldGroup, Host } from "@expo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform } from "react-native";
import { FieldRow } from "@/components/ui/FieldRow";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { developerToolsEnabled } from "@/lib/developer-tools";
import {
  addPreviewConventions,
  resetPreviewConventions,
} from "@/lib/preview-convention";
import { scheduleTestNotification } from "@/services/notifications";

export default function PreviewScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const colorScheme = useResolvedColorScheme();
  const queryClient = useQueryClient();
  const variant = Constants.expoConfig?.extra?.appVariant;
  const [testing, setTesting] = useState(false);
  const samples = useMutation({
    mutationFn: (restore: boolean) =>
      (restore ? resetPreviewConventions : addPreviewConventions)(
        __DEV__,
        variant,
      ),
    onSuccess: async (id) => {
      if (!id) return;
      await Promise.all(
        ["conventions", "convention", "events", "schedule"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      router.navigate("/(tabs)/(home)");
    },
    onError: () => Alert.alert(t("common.error"), t("settings.preview.error")),
  });

  if (!developerToolsEnabled(__DEV__, variant))
    return <Redirect href="/(tabs)/settings" />;

  async function testReminder() {
    if (testing || Platform.OS === "web") return;
    setTesting(true);
    try {
      const id = await scheduleTestNotification();
      Alert.alert(
        t("settings.preview.testReminder"),
        t(
          id
            ? "settings.preview.testScheduled"
            : "settings.notifications.disabled",
        ),
      );
    } catch {
      Alert.alert(t("common.error"), t("settings.preview.error"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Host
      colorScheme={colorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section disabled={samples.isPending || testing}>
          <FieldRow
            testID="preview-add-samples"
            supportingText={t("settings.preview.description")}
            onPress={() => samples.mutate(false)}
          >
            {t("settings.preview.add")}
          </FieldRow>
          <FieldRow
            testID="preview-restore-samples"
            supportingText={t("settings.preview.restoreConfirm")}
            onPress={() =>
              Alert.alert(
                t("settings.preview.restore"),
                t("settings.preview.restoreConfirm"),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("settings.dataImport.confirmAction"),
                    onPress: () => samples.mutate(true),
                  },
                ],
              )
            }
          >
            {t("settings.preview.restore")}
          </FieldRow>
          <FieldRow
            testID="preview-test-reminder"
            supportingText={t(
              Platform.OS === "web"
                ? "settings.preview.nativeOnly"
                : "settings.preview.testDescription",
            )}
            onPress={
              Platform.OS === "web" ? undefined : () => void testReminder()
            }
          >
            {t("settings.preview.testReminder")}
          </FieldRow>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
