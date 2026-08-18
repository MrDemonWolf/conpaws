import { useColorScheme, View } from "react-native";

export function OnboardingBackground() {
  const colorScheme = useColorScheme();

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute inset-0"
      style={{
        experimental_backgroundImage:
          colorScheme === "dark"
            ? "radial-gradient(circle at 50% 24%, rgba(15, 172, 237, 0.26) 0%, rgba(15, 172, 237, 0.08) 32%, transparent 62%), radial-gradient(circle at 95% 88%, rgba(56, 189, 248, 0.12) 0%, transparent 42%)"
            : "radial-gradient(circle at 50% 24%, rgba(15, 172, 237, 0.18) 0%, rgba(15, 172, 237, 0.05) 34%, transparent 64%), radial-gradient(circle at 95% 88%, rgba(9, 21, 51, 0.06) 0%, transparent 42%)",
      }}
    />
  );
}
