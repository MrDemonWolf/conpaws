import { Pressable, View } from "react-native";
import { Badge, Card, CardContent, Text } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ConventionCardProps {
  name: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "ended";
  eventCount?: number;
  onPress?: () => void;
  className?: string;
}

const statusLabels: Record<ConventionCardProps["status"], string> = {
  upcoming: "Upcoming",
  active: "Active",
  ended: "Ended",
};

export function ConventionCard({
  name,
  startDate,
  endDate,
  status,
  eventCount,
  onPress,
  className,
}: ConventionCardProps) {
  return (
    <Pressable onPress={onPress} className={cn("active:opacity-80", className)}>
      <Card>
        <CardContent className="py-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-1">
              <Text variant="h3">{name}</Text>
              <Text variant="caption">
                {startDate} – {endDate}
              </Text>
            </View>
            <Badge variant={status} label={statusLabels[status]} />
          </View>
          {eventCount === undefined ? null : (
            <View className="mt-3 flex-row items-center">
              <Text variant="caption">
                {eventCount} event{eventCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </CardContent>
      </Card>
    </Pressable>
  );
}
