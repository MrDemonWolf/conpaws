import { Switch as RNSwitch, type SwitchProps } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";

export function Switch(props: SwitchProps) {
  const { isDark } = useColorScheme();

  return (
    <RNSwitch
      trackColor={{
        false: isDark ? "#44403c" : "#e7e5e4",
        true: isDark ? "#8b5cf6" : "#6D28D9",
      }}
      thumbColor="#ffffff"
      {...props}
    />
  );
}
