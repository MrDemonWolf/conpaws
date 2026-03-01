import { Switch as RNSwitch, type SwitchProps } from "react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";

export function Switch(props: SwitchProps) {
  const colors = useThemeColors();

  return (
    <RNSwitch
      trackColor={{
        false: colors.input,
        true: colors.primary,
      }}
      thumbColor={colors.primaryForeground}
      {...props}
    />
  );
}
