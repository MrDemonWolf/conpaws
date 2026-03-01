import { User } from "@/lib/icons";
import { EmptyState } from "@/components/empty-state";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

export default function ProfileScreen() {
  const colors = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <EmptyState
        icon={<User size={48} color={colors.mutedForeground} />}
        title="Profiles coming soon"
        description="Create your furry profile and share it with friends. Coming in a future update!"
      />
    </SafeAreaView>
  );
}
