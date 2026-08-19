import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <View className={cn("bg-background px-4 pt-5 pb-2", className)}>
      <Text variant="h3">{title}</Text>
    </View>
  );
}
