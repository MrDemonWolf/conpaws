import { useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { FileText, Calendar } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useICalImport } from "@/hooks/use-ical-import";
import { isValidSchedUrl } from "@/lib/sched-url";
import { useThemeColors } from "@/hooks/use-theme-colors";

export default function ImportScreen() {
  const router = useRouter();
  const { pickAndParseFile, fetchAndParseUrl, isLoading, error } =
    useICalImport();
  const colors = useThemeColors();
  const [schedUrl, setSchedUrl] = useState("");

  const handleFilePick = async () => {
    const parsed = await pickAndParseFile();
    if (parsed) {
      router.push({
        pathname: "/convention/import-preview",
        params: { data: JSON.stringify(parsed) },
      });
    }
  };

  const handleUrlFetch = async () => {
    if (!isValidSchedUrl(schedUrl)) return;
    const parsed = await fetchAndParseUrl(schedUrl.trim());
    if (parsed) {
      router.push({
        pathname: "/convention/import-preview",
        params: { data: JSON.stringify(parsed), url: schedUrl.trim() },
      });
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Import Schedule" }} />
      <View className="flex-1 bg-background px-6 pt-6">
        <Text className="mb-6 text-lg text-muted-foreground">
          Import events from a .ics file or a Sched convention URL.
        </Text>

        <Card className="mb-4 p-4">
          <View className="mb-3 flex-row items-center gap-3">
            <FileText size={22} color={colors.primary} />
            <Text className="text-base font-semibold text-foreground">
              Import .ics File
            </Text>
          </View>
          <Text className="mb-4 text-sm text-muted-foreground">
            Pick a calendar file from your device.
          </Text>
          <Button
            variant="outline"
            onPress={handleFilePick}
            disabled={isLoading}
          >
            Choose File
          </Button>
        </Card>

        <Card className="p-4">
          <View className="mb-3 flex-row items-center gap-3">
            <Calendar size={22} color={colors.primary} />
            <Text className="text-base font-semibold text-foreground">
              Paste Sched URL
            </Text>
          </View>
          <Text className="mb-4 text-sm text-muted-foreground">
            Enter a Sched convention URL (e.g.
            https://mycon2026.sched.com)
          </Text>
          <Input
            value={schedUrl}
            onChangeText={setSchedUrl}
            placeholder="https://convention.sched.com"
            autoCapitalize="none"
            keyboardType="url"
            className="mb-3"
          />
          <Button
            variant="outline"
            onPress={handleUrlFetch}
            disabled={isLoading || !isValidSchedUrl(schedUrl)}
          >
            Fetch Schedule
          </Button>
        </Card>

        {isLoading && (
          <View className="mt-6 items-center">
            <ActivityIndicator size="large" />
            <Text className="mt-2 text-sm text-muted-foreground">
              Loading schedule...
            </Text>
          </View>
        )}

        {error && (
          <View className="mt-4 rounded-xl bg-destructive/10 p-4">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        )}
      </View>
    </>
  );
}
