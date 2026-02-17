import { View, Text, Pressable } from "react-native";
import { Calendar, Check, Clock, MapPin } from "@/lib/icons";
import { formatEventTime } from "@/lib/date-utils";
import { CATEGORY_COLORS } from "@/lib/constants";
import { useColorScheme } from "@/lib/useColorScheme";
import type { ConventionEvent } from "@/types";

interface EventItemProps {
  event: ConventionEvent;
  onPress?: () => void;
}

export function EventItem({ event, onPress }: EventItemProps) {
  const { isDark } = useColorScheme();
  const categoryColor =
    CATEGORY_COLORS[event.category ?? ""] ?? CATEGORY_COLORS.DEFAULT;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start border-b border-border px-4 py-3 active:bg-accent"
    >
      <View
        className="mr-3 mt-1 h-3 w-3 rounded-full"
        style={{ backgroundColor: categoryColor }}
      />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base font-medium text-foreground">
            {event.title}
          </Text>
          {event.isInSchedule && (
            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Check size={12} color="#ffffff" />
            </View>
          )}
        </View>
        <View className="mt-1 flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Clock size={12} color={isDark ? "#a8a29e" : "#78716c"} />
            <Text className="text-xs text-muted-foreground">
              {formatEventTime(event.startTime, event.endTime)}
            </Text>
          </View>
          {event.room && (
            <View className="flex-row items-center gap-1">
              <MapPin size={12} color={isDark ? "#a8a29e" : "#78716c"} />
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {event.room}
              </Text>
            </View>
          )}
        </View>
        {event.isAgeRestricted && (
          <Text className="mt-1 text-xs font-medium text-destructive">
            18+ Only
          </Text>
        )}
      </View>
    </Pressable>
  );
}
