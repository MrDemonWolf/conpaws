import { View, Text, SectionList, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Edit3, Trash2, Calendar } from "@/lib/icons";
import { useConvention, useDeleteConvention } from "@/hooks/use-conventions";
import { useEvents } from "@/hooks/use-events";
import { EventItem } from "@/components/event-item";
import { EventDayHeader } from "@/components/event-day-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatDateRange, groupEventsByDay } from "@/lib/date-utils";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { ConventionStatus } from "@/types";

export default function ConventionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: convention } = useConvention(id);
  const { data: events = [] } = useEvents(id);
  const deleteConvention = useDeleteConvention();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const sections = groupEventsByDay(events);

  const handleDelete = () => {
    Alert.alert(
      "Delete Convention",
      `Are you sure you want to delete "${convention?.name}"? This will also delete all events.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteConvention.mutateAsync(id);
            router.back();
          },
        },
      ],
    );
  };

  if (!convention) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: convention.name,
          headerRight: () => (
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => router.push(`/convention/${id}/edit`)}
                className="p-1"
              >
                <Edit3 size={20} color={colors.foreground} />
              </Pressable>
              <Pressable onPress={handleDelete} className="p-1">
                <Trash2 size={20} color={colors.destructive} />
              </Pressable>
            </View>
          ),
        }}
      />

      <View className="flex-1 bg-background">
        <View className="border-b border-border px-6 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">
              {formatDateRange(convention.startDate, convention.endDate)}
            </Text>
            <StatusBadge status={convention.status as ConventionStatus} />
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">
            {events.length} {events.length === 1 ? "event" : "events"}
          </Text>
        </View>

        {events.length === 0 ? (
          <EmptyState
            icon={
              <Calendar size={48} color={colors.mutedForeground} />
            }
            title="No events yet"
            description="Add events manually or import a schedule."
            actionLabel="Add Event"
            onAction={() =>
              router.push(`/convention/${id}/event/new`)
            }
          />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <EventDayHeader title={section.title} />
            )}
            renderItem={({ item }) => (
              <EventItem
                event={item}
                onPress={() =>
                  router.push(
                    `/convention/${id}/event/${item.id}`,
                  )
                }
              />
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        <View
          className="absolute right-6 flex-row gap-3"
          style={{ bottom: Math.max(insets.bottom, 16) + 16 }}
        >
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onPress={() => router.push("/convention/import")}
          >
            <Calendar size={20} color={colors.foreground} />
          </Button>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full"
            onPress={() =>
              router.push(`/convention/${id}/event/new`)
            }
          >
            <Plus size={20} color={colors.primaryForeground} />
          </Button>
        </View>
      </View>
    </>
  );
}
