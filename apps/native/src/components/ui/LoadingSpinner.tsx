import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  className?: string;
}

export function LoadingSpinner({
  size = "large",
  className,
}: LoadingSpinnerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      className={cn("flex-1 items-center justify-center", className)}
    >
      <ActivityIndicator size={size} color={colors.primary} />
    </View>
  );
}
