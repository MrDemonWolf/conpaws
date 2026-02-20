import { User } from "@/lib/icons";
import { EmptyState } from "@/components/empty-state";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "@/lib/useColorScheme";

export default function ProfileScreen() {
  const { isDark } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <EmptyState
        icon={<User size={48} color={isDark ? "#a8a29e" : "#78716c"} />}
        title="Profiles coming soon"
        description="Create your furry profile and share it with friends. Coming in a future update!"
      />
    </SafeAreaView>
  );
}
