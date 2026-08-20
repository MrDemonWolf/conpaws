import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/Text";
import licenseManifest from "@/generated/open-source-licenses.json";

function safeExternalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : "";
}

export default function LicenseDetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const index = Number(id);
  const packageInfo = Number.isInteger(index)
    ? licenseManifest.packages[index]
    : undefined;

  if (!packageInfo) {
    return (
      <View className="flex-1 items-center justify-center gap-1.5 p-8">
        <Stack.Screen
          options={{ title: t("settings.licenses.detailsTitle") }}
        />
        <Text variant="h3" className="text-center">
          {t("settings.licenses.packageNotFoundTitle")}
        </Text>
        <Text variant="caption" className="text-center">
          {t("settings.licenses.packageNotFoundDescription")}
        </Text>
      </View>
    );
  }

  const licenseText = packageInfo.textId
    ? licenseManifest.texts[
        packageInfo.textId as keyof typeof licenseManifest.texts
      ]
    : "";
  const repository = safeExternalUrl(packageInfo.repository);
  const homepage = safeExternalUrl(packageInfo.homepage);
  const links = [
    repository
      ? { label: t("settings.licenses.repository"), url: repository }
      : null,
    homepage && homepage !== repository
      ? { label: t("settings.licenses.projectWebsite"), url: homepage }
      : null,
  ].filter((link): link is { label: string; url: string } => link !== null);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pt-4 pb-10"
    >
      <Stack.Screen options={{ title: packageInfo.name }} />
      <View
        accessible
        accessibilityRole="summary"
        className="gap-1 rounded-2xl border border-border bg-card p-4"
        style={{ borderCurve: "continuous" }}
      >
        <Text selectable variant="h3" className="text-xl">
          {packageInfo.name}
        </Text>
        <Text selectable variant="caption">
          {t("settings.licenses.version", { version: packageInfo.version })}
        </Text>
        <Text selectable variant="caption">
          {t("settings.licenses.license", { license: packageInfo.license })}
        </Text>
      </View>

      {links.length > 0 ? (
        <View className="gap-2">
          {links.map(({ label, url }) => (
            <Pressable
              accessibilityRole="link"
              key={label}
              onPress={() => WebBrowser.openBrowserAsync(url)}
              className="min-h-12 flex-row items-center rounded-xl border border-border bg-card px-4 active:opacity-65"
              style={{ borderCurve: "continuous" }}
            >
              <Text
                variant="body"
                className="flex-1 font-semibold text-primary"
              >
                {label}
              </Text>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                variant="body"
                className="ml-3 text-lg text-primary"
              >
                ↗
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text accessibilityRole="header" variant="caption" className="px-1">
        {t("settings.licenses.license", { license: packageInfo.license })}
      </Text>
      <View
        className="rounded-2xl border border-border bg-card p-4"
        style={{ borderCurve: "continuous" }}
      >
        <Text selectable variant="caption" className="text-foreground">
          {licenseText || t("settings.licenses.licenseTextUnavailable")}
        </Text>
      </View>
    </ScrollView>
  );
}
