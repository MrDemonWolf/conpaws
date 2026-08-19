import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  listRowInsets,
  listStyle,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "react-native";

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
  deleteLabel,
  onDelete,
}: ConventionListProps<T>) {
  const colorScheme = useColorScheme();

  return (
    <Host
      colorScheme={colorScheme === "dark" ? "dark" : "light"}
      style={{ flex: 1 }}
    >
      <List modifiers={[listStyle("plain")]}>
        {data.map((item) => {
          const row = getRowContent(item);
          return (
            <SwipeActions
              key={item.id}
              modifiers={[
                listRowInsets({
                  top: 0,
                  leading: 16,
                  bottom: 0,
                  trailing: 16,
                }),
              ]}
            >
              <Button
                onPress={() => onOpen(item)}
                modifiers={[
                  buttonStyle("plain"),
                  accessibilityLabel(
                    `${row.name}, ${row.dateRange}, ${row.statusLabel}`,
                  ),
                ]}
              >
                <HStack
                  spacing={12}
                  modifiers={[
                    frame({ maxWidth: Infinity, minHeight: 44 }),
                    padding({ vertical: 10 }),
                    contentShape(shapes.rectangle()),
                  ]}
                >
                  <VStack alignment="leading" spacing={3}>
                    <Text
                      modifiers={[
                        font({ textStyle: "body", weight: "semibold" }),
                      ]}
                    >
                      {row.name}
                    </Text>
                    <HStack spacing={8}>
                      <Text
                        modifiers={[
                          font({ textStyle: "caption" }),
                          foregroundStyle({
                            type: "hierarchical",
                            style: "secondary",
                          }),
                        ]}
                      >
                        {row.dateRange}
                      </Text>
                      <Text
                        modifiers={[
                          font({ textStyle: "caption" }),
                          foregroundStyle({
                            type: "hierarchical",
                            style:
                              row.status === "ended" ? "secondary" : "primary",
                          }),
                        ]}
                      >
                        {row.statusLabel}
                      </Text>
                    </HStack>
                  </VStack>
                  <Spacer />
                  <Image
                    systemName="chevron.right"
                    modifiers={[
                      font({ textStyle: "caption", weight: "semibold" }),
                      foregroundStyle({
                        type: "hierarchical",
                        style: "tertiary",
                      }),
                    ]}
                  />
                </HStack>
              </Button>
              <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                {/* biome-ignore lint/a11y/useValidAriaRole: Expo UI maps this prop to SwiftUI ButtonRole. */}
                <Button
                  label={deleteLabel}
                  systemImage="trash"
                  role="destructive"
                  onPress={() => onDelete(item)}
                />
              </SwipeActions.Actions>
            </SwipeActions>
          );
        })}
      </List>
    </Host>
  );
}
