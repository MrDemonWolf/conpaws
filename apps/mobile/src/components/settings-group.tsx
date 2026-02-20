import { View, Text } from "react-native";

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <View className="mb-6">
      <Text className="mb-2 px-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </Text>
      <View className="mx-4 overflow-hidden rounded-xl border border-border bg-card">
        {children}
      </View>
    </View>
  );
}
