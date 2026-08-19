import { FlatList, View } from "react-native";
import { ConventionCard } from "./ConventionCard";

interface ConventionRowContent {
  name: string;
  dateRange: string;
  status: "upcoming" | "active" | "ended";
  statusLabel: string;
  moreAccessibilityLabel: string;
}

interface ConventionListProps<T extends { id: string }> {
  data: T[];
  getRowContent: (item: T) => ConventionRowContent;
  onOpen: (item: T) => void;
  deleteLabel: string;
  onDelete: (item: T) => void;
}

export function ConventionList<T extends { id: string }>({
  data,
  getRowContent,
  onOpen,
  onDelete,
}: ConventionListProps<T>) {
  return (
    <FlatList
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="always"
      alwaysBounceVertical={false}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 24,
      }}
      ItemSeparatorComponent={() => <View className="ml-1 h-px bg-border" />}
      renderItem={({ item }) => {
        const row = getRowContent(item);
        return (
          <ConventionCard
            {...row}
            onPress={() => onOpen(item)}
            onMorePress={() => onDelete(item)}
          />
        );
      }}
    />
  );
}
