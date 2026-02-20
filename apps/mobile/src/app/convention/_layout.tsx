import { Stack } from "expo-router";

export default function ConventionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: "transparent" },
      }}
    />
  );
}
