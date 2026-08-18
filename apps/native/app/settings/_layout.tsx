import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";

export default function SettingsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
      }}
    />
  );
}
