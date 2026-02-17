import { View, Text, ScrollView, Pressable, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Clock,
  MapPin,
  Edit3,
  Trash2,
  ExternalLink,
  Shield,
} from "@/lib/icons";
import { useEvent, useToggleSchedule, useSetReminder, useDeleteEvent } from "@/hooks/use-events";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatEventTime, formatDayHeader } from "@/lib/date-utils";
import { REMINDER_OPTIONS } from "@/lib/constants";
import { useColorScheme } from "@/lib/useColorScheme";

export default function EventDetailScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const router = useRouter();
  const { data: event } = useEvent(eventId);
  const toggleSchedule = useToggleSchedule();
  const setReminder = useSetReminder();
  const deleteEvent = useDeleteEvent();
  const { isDark } = useColorScheme();

  if (!event) return null;

  const handleDelete = () => {
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteEvent.mutateAsync({
            id: eventId,
            conventionId: id,
          });
          router.back();
        },
      },
    ]);
  };

  const handleReminderPress = () => {
    Alert.alert(
      "Set Reminder",
      "Choose when to be reminded",
      REMINDER_OPTIONS.map((opt) => ({
        text: opt.label,
        onPress: () =>
          setReminder.mutate({
            id: eventId,
            conventionId: id,
            reminderMinutes: opt.value,
          }),
      })),
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Event Details",
          headerRight: () =>
            event.type === "custom" ? (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() =>
                    router.push(
                      `/convention/${id}/event/${eventId}/edit`,
                    )
                  }
                  className="p-1"
                >
                  <Edit3 size={20} color={isDark ? "#fafaf9" : "#0a0a0a"} />
                </Pressable>
                <Pressable onPress={handleDelete} className="p-1">
                  <Trash2 size={20} color="#ef4444" />
                </Pressable>
              </View>
            ) : null,
        }}
      />

      <ScrollView className="flex-1 bg-background">
        <View className="px-6 py-6">
          <View className="flex-row items-center gap-2">
            {event.category && (
              <Badge
                variant="secondary"
                className="flex-row items-center gap-1"
              >
                {event.category}
              </Badge>
            )}
            {event.isAgeRestricted && (
              <Badge variant="destructive">18+</Badge>
            )}
          </View>

          <Text className="mt-3 text-2xl font-bold text-foreground">
            {event.title}
          </Text>

          <View className="mt-4 gap-3">
            <View className="flex-row items-center gap-3">
              <Clock size={18} color={isDark ? "#a8a29e" : "#78716c"} />
              <View>
                <Text className="text-sm text-muted-foreground">
                  {formatDayHeader(event.startTime)}
                </Text>
                <Text className="text-base text-foreground">
                  {formatEventTime(event.startTime, event.endTime)}
                </Text>
              </View>
            </View>

            {(event.location || event.room) && (
              <View className="flex-row items-center gap-3">
                <MapPin size={18} color={isDark ? "#a8a29e" : "#78716c"} />
                <View>
                  {event.room && (
                    <Text className="text-base text-foreground">
                      {event.room}
                    </Text>
                  )}
                  {event.location && (
                    <Text className="text-sm text-muted-foreground">
                      {event.location}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        <Separator />

        {event.description && (
          <>
            <View className="px-6 py-4">
              <Text className="text-base leading-6 text-foreground">
                {event.description}
              </Text>
            </View>
            <Separator />
          </>
        )}

        {event.contentWarning && (
          <>
            <View className="flex-row items-start gap-3 px-6 py-4">
              <Shield size={18} color="#f59e0b" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-gold">
                  Content Warning
                </Text>
                <Text className="mt-0.5 text-sm text-muted-foreground">
                  {event.contentWarning}
                </Text>
              </View>
            </View>
            <Separator />
          </>
        )}

        <Card className="mx-6 my-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-medium text-foreground">
              Add to My Schedule
            </Text>
            <Switch
              value={event.isInSchedule}
              onValueChange={(value) =>
                toggleSchedule.mutate({
                  id: eventId,
                  conventionId: id,
                  isInSchedule: value,
                })
              }
            />
          </View>

          <Separator className="my-3" />

          <Pressable
            onPress={handleReminderPress}
            className="flex-row items-center justify-between"
          >
            <Text className="text-base font-medium text-foreground">
              Reminder
            </Text>
            <Text className="text-sm text-muted-foreground">
              {event.reminderMinutes
                ? REMINDER_OPTIONS.find(
                    (o) => o.value === event.reminderMinutes,
                  )?.label ?? `${event.reminderMinutes}m`
                : "None"}
            </Text>
          </Pressable>
        </Card>

        {event.sourceUrl && (
          <Pressable
            onPress={() => Linking.openURL(event.sourceUrl!)}
            className="mx-6 mb-8 flex-row items-center justify-center gap-2 rounded-xl border border-border py-3"
          >
            <ExternalLink size={16} color={isDark ? "#8b5cf6" : "#6D28D9"} />
            <Text className="text-sm font-medium text-primary">
              View on Sched
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}
