import { FlatList, View } from "react-native";
import { Text } from "@/components/ui";
import { useContentWidth } from "@/hooks/useContentWidth";
import { ConventionCard } from "./ConventionCard.android";
import type { ConventionListProps } from "./ConventionList.types";

/**
 * `deleteLabel`, `onDelete`, `archiveItemLabel`, `onArchive`,
 * `unarchiveItemLabel` and `onUnarchive` are deliberately not destructured
 * here: an Android `FlatList` row has no swipe affordance, so this
 * implementation offers these actions through its native row menu instead.
 * See the note on those props in `ConventionList.types.ts`.
 */
export function ConventionList<T extends { id: string }>({
  data,
  archivedData,
  archiveExpanded,
  archiveLabel,
  currentEmptyLabel,
  getRowContent,
  onOpen,
  onAction,
}: ConventionListProps<T>) {
  // Zero on a phone in portrait; the readable column on a wide window, and
  // the side navigation bar or cutout on a phone in landscape.
  const { listPadding } = useContentWidth();
  return (
    <FlatList
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      alwaysBounceVertical={false}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingHorizontal: 16 + listPadding.paddingHorizontal,
        paddingBottom: 24,
      }}
      ListEmptyComponent={
        archivedData.length > 0 ? (
          <View className="py-6">
            <Text variant="body" className="text-muted-foreground">
              {currentEmptyLabel}
            </Text>
          </View>
        ) : undefined
      }
      ListFooterComponent={
        archiveExpanded && archivedData.length > 0 ? (
          <View className="mt-2 border-t border-border">
            <Text variant="label" className="px-1 py-3">
              {archiveLabel}
            </Text>
            <View className="border-t border-border">
              {/* ponytail: convention archives stay small; virtualize if imports become unbounded. */}
              {archivedData.map((item, index) => {
                const row = getRowContent(item);
                return (
                  <View key={item.id}>
                    <ConventionCard
                      {...row}
                      onPress={() => onOpen(item)}
                      onAction={(action) => onAction(item, action)}
                    />
                    {index < archivedData.length - 1 ? (
                      <View className="ml-1 h-px bg-border" />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : undefined
      }
      ItemSeparatorComponent={() => <View className="ml-1 h-px bg-border" />}
      renderItem={({ item }) => {
        const row = getRowContent(item);
        return (
          <ConventionCard
            {...row}
            onPress={() => onOpen(item)}
            onAction={(action) => onAction(item, action)}
          />
        );
      }}
    />
  );
}
