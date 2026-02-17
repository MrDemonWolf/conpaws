import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Check } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useICalImport } from "@/hooks/use-ical-import";
import { formatDateRange } from "@/lib/date-utils";
import { CATEGORY_COLORS } from "@/lib/constants";
import type { ParsedCalendar } from "@/lib/ical-parser";

export default function ImportPreviewScreen() {
  const { data } = useLocalSearchParams<{ data: string; url?: string }>();
  const router = useRouter();
  const { importEvents, isLoading } = useICalImport();

  const calendar: ParsedCalendar | null = useMemo(() => {
    if (!data) return null;
    try {
      return JSON.parse(data) as ParsedCalendar;
    } catch {
      return null;
    }
  }, [data]);

  if (!calendar) {
    return (
      <>
        <Stack.Screen options={{ title: "Import Preview" }} />
        <View className="flex-1 items-center justify-center bg-background px-8">
          <Text className="text-base text-muted-foreground">
            Failed to load import data.
          </Text>
          <Button onPress={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </View>
      </>
    );
  }

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(calendar.events.map((_, i) => i)),
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of calendar.events) {
      const cat = event.category ?? "Other";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [calendar.events]);

  const toggleEvent = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIndices.size === calendar.events.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(calendar.events.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    const conventionId = await importEvents(calendar, selectedIndices);
    if (conventionId) {
      router.dismissAll();
      router.push(`/convention/${conventionId}`);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Import Preview" }} />
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <Text className="text-2xl font-bold text-foreground">
            {calendar.name}
          </Text>
          {calendar.startDate && calendar.endDate && (
            <Text className="mt-1 text-sm text-muted-foreground">
              {formatDateRange(calendar.startDate, calendar.endDate)}
            </Text>
          )}
          <Text className="mt-1 text-sm text-muted-foreground">
            {calendar.events.length} events found
          </Text>

          {categories.length > 0 && (
            <View className="mt-4 flex-row flex-wrap gap-2">
              {categories.map(([cat, count]) => (
                <Badge key={cat} variant="secondary">
                  {`${cat} (${count})`}
                </Badge>
              ))}
            </View>
          )}

          <View className="mt-6">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">
                Events
              </Text>
              <Pressable onPress={toggleAll}>
                <Text className="text-sm font-medium text-primary">
                  {selectedIndices.size === calendar.events.length
                    ? "Deselect All"
                    : "Select All"}
                </Text>
              </Pressable>
            </View>

            {calendar.events.map((event, index) => {
              const isSelected = selectedIndices.has(index);
              const categoryColor =
                CATEGORY_COLORS[event.category ?? ""] ??
                CATEGORY_COLORS.DEFAULT;

              return (
                <Pressable
                  key={event.uid || index}
                  onPress={() => toggleEvent(index)}
                  className="flex-row items-center border-b border-border py-3"
                >
                  <View
                    className={`mr-3 h-5 w-5 items-center justify-center rounded ${
                      isSelected
                        ? "bg-primary"
                        : "border border-input"
                    }`}
                  >
                    {isSelected && <Check size={12} color="#ffffff" />}
                  </View>
                  <View
                    className="mr-2 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                  />
                  <View className="flex-1">
                    <Text
                      className="text-sm font-medium text-foreground"
                      numberOfLines={1}
                    >
                      {event.title}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      {event.category && (
                        <Text className="text-xs text-muted-foreground">
                          {event.category}
                        </Text>
                      )}
                      {event.isAgeRestricted && (
                        <Text className="text-xs font-medium text-destructive">
                          18+
                        </Text>
                      )}
                      {event.contentWarning && (
                        <Text className="text-xs text-gold">
                          ⚠ {event.contentWarning}
                        </Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View className="border-t border-border px-6 py-4">
          <Button
            onPress={handleImport}
            disabled={isLoading || selectedIndices.size === 0}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              `Import ${selectedIndices.size} Events`
            )}
          </Button>
        </View>
      </View>
    </>
  );
}
