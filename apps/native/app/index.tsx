import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl font-bold text-primary mb-4">ConPaws</Text>
        <Text className="text-lg text-muted-foreground text-center">
          Navigate, Connect, Enjoy
        </Text>
      </View>
    </SafeAreaView>
  );
}
