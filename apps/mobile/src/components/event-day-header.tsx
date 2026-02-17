import { View, Text } from "react-native";

interface EventDayHeaderProps {
  title: string;
}

export function EventDayHeader({ title }: EventDayHeaderProps) {
  return (
    <View className="bg-background px-4 py-2">
      <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </Text>
    </View>
  );
}
