import { AlertTriangle, Bell, ShieldAlert } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CategoryPill } from "./CategoryPill";

interface EventItemProps {
  title: string;
  startTime: string;
  endTime?: string;
  room?: string;
  category?: string;
  isInSchedule?: boolean;
  hasReminder?: boolean;
  hasConflict?: boolean;
  isAgeRestricted?: boolean;
  contentWarning?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  className?: string;
}

export function EventItem({
  title,
  startTime,
  endTime,
  room,
  category,
  isInSchedule = false,
  hasReminder = false,
  hasConflict = false,
  isAgeRestricted = false,
  contentWarning = false,
  onPress,
  onLongPress,
  className,
}: EventItemProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      className={cn(
        "flex-row items-start gap-3 py-3 px-4 active:opacity-70",
        className,
      )}
    >
      <View className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between">
          <Text variant="label" className="flex-1 pr-2">
            {title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {isAgeRestricted && <ShieldAlert size={14} color="#EF4444" />}
            {contentWarning && <AlertTriangle size={14} color="#F59E0B" />}
            {hasReminder && <Bell size={14} color="#0FACED" />}
            {isInSchedule && <Text className="text-primary text-lg">✓</Text>}
          </View>
        </View>
        <Text variant="caption">
          {startTime}
          {endTime ? ` – ${endTime}` : ""}
          {room ? ` · ${room}` : ""}
        </Text>
        {hasConflict ? (
          <Text variant="caption" className="text-destructive">
            Schedule conflict
          </Text>
        ) : null}
        {category ? (
          <CategoryPill label={category} className="self-start mt-1" />
        ) : null}
      </View>
    </Pressable>
  );
}
