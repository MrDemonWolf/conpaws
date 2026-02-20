import { View, Text } from "react-native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateRange } from "@/lib/date-utils";
import type { Convention } from "@/types";

interface ConventionCardProps {
  convention: Convention;
  eventCount?: number;
}

export function ConventionCard({ convention, eventCount }: ConventionCardProps) {
  const statusVariant =
    convention.status === "active"
      ? "active"
      : convention.status === "upcoming"
        ? "upcoming"
        : "ended";

  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">
            {convention.name}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {formatDateRange(convention.startDate, convention.endDate)}
          </Text>
        </View>
        <Badge variant={statusVariant}>
          {convention.status.charAt(0).toUpperCase() +
            convention.status.slice(1)}
        </Badge>
      </View>
      {eventCount !== undefined && (
        <Text className="mt-2 text-xs text-muted-foreground">
          {eventCount} {eventCount === 1 ? "event" : "events"}
        </Text>
      )}
    </Card>
  );
}
