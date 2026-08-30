import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, FlatList, View } from "react-native";

import { EmptyState, Row, Text } from "@/components/ui";
import licenseManifest from "@/generated/open-source-licenses.json";
import { cn } from "@/lib/utils";

type LicensePackage = {
  name: string;
  version: string;
  license: string;
  index: number;
};

const packages: LicensePackage[] = licenseManifest.packages.map(
  ({ name, version, license }, index) => ({ name, version, license, index }),
);

export default function LicensesScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredPackages = normalizedQuery
    ? packages.filter(({ name, version, license }) =>
        `${name} ${version} ${license}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : packages;

  useEffect(() => {
    if (!normalizedQuery) return;
    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(
        t("settings.licenses.packageCount", {
          count: filteredPackages.length,
        }),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [filteredPackages.length, normalizedQuery, t]);

  return (
    <>
      <Stack.SearchBar
        autoCapitalize="none"
        hideWhenScrolling={false}
        onCancelButtonPress={() => setQuery("")}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onClose={() => setQuery("")}
        placeholder={t("settings.licenses.searchPlaceholder")}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4 pt-3 pb-8"
        data={filteredPackages}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={({ index, name, version }) =>
          `${name}@${version}:${index}`
        }
        ListHeaderComponent={
          <Text
            accessibilityRole="header"
            variant="caption"
            className="px-1 pb-2"
          >
            {t("settings.licenses.packageCount", {
              count: filteredPackages.length,
            })}
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            className="px-8 py-20"
            title={t("settings.licenses.noResultsTitle")}
            subtitle={t("settings.licenses.noResultsDescription")}
          />
        }
        renderItem={({ item, index }) => (
          <Row
            accessibilityLabel={`${item.name}, ${t(
              "settings.licenses.version",
              {
                version: item.version,
              },
            )}, ${t("settings.licenses.license", {
              license: item.license,
            })}`}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/settings/licenses/[id]",
                params: { id: String(item.index) },
              })
            }
            className={cn(
              "min-h-14 border-r border-b border-l border-border bg-card px-4 py-2.5",
              index === 0 && "rounded-t-xl border-t",
              index === filteredPackages.length - 1 && "rounded-b-xl",
            )}
            trailing={
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                variant="body"
                className="text-2xl text-muted-foreground"
              >
                ›
              </Text>
            }
          >
            <View className="gap-0.5">
              <Text numberOfLines={1} variant="body" className="font-semibold">
                {item.name}
              </Text>
              <Text numberOfLines={1} variant="caption">
                {item.version} · {item.license}
              </Text>
            </View>
          </Row>
        )}
      />
    </>
  );
}
