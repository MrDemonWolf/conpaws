import { FlatList, Pressable, View } from "react-native";
import { Text } from "@/components/ui";
import { ConventionCard } from "./ConventionCard";
import type { ConventionListProps } from "./ConventionList.types";

/**
 * `deleteLabel`, `onDelete`, `archiveItemLabel` and `onArchive` are deliberately
 * not destructured here: a `FlatList` row has no swipe affordance, so this
 * implementation offers both actions through `onOpenActions` instead. See the
 * note on those props in `ConventionList.types.ts`.
 */
export function ConventionList<T extends { id: string }>({
  data,
  archivedData,
  archiveExpanded,
  archiveLabel,
  archiveActionLabel,
  currentEmptyLabel,
  onToggleArchive,
  getRowContent,
  onOpen,
  onOpenActions,
}: ConventionListProps<T>) {
  return (
    <FlatList
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      alwaysBounceVertical={false}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 24,
      }}
      ListEmptyComponent={
        archivedData.length > 0 ? (
          <View className="py-6">
            <Text variant="body" className="text-muted-foreground">
              {currentEmptyLabel}
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        archivedData.length > 0 ? (
          <View className="mt-2 border-t border-border">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${archiveLabel}, ${archiveActionLabel}`}
              accessibilityState={{ expanded: archiveExpanded }}
              onPress={onToggleArchive}
              className="min-h-12 flex-row items-center justify-between px-1 py-3 active:opacity-60"
            >
              <Text variant="label">{archiveLabel}</Text>
              <Text variant="caption">{archiveActionLabel}</Text>
            </Pressable>
            {archiveExpanded ? (
              <View className="border-t border-border">
                {/* ponytail: convention archives stay small; virtualize if imports become unbounded. */}
                {archivedData.map((item, index) => {
                  const row = getRowContent(item);
                  return (
                    <View key={item.id}>
                      <ConventionCard
                        {...row}
                        onPress={() => onOpen(item)}
                        onMorePress={() => onOpenActions(item)}
                      />
                      {index < archivedData.length - 1 ? (
                        <View className="ml-1 h-px bg-border" />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null
      }
      ItemSeparatorComponent={() => <View className="ml-1 h-px bg-border" />}
      renderItem={({ item }) => {
        const row = getRowContent(item);
        return (
          <ConventionCard
            {...row}
            onPress={() => onOpen(item)}
            onMorePress={() => onOpenActions(item)}
          />
        );
      }}
    />
  );
}
