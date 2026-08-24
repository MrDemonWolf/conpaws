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
  archivedData: T[];
  archiveExpanded: boolean;
  archiveLabel: string;
  archiveActionLabel: string;
  currentEmptyLabel: string;
  onToggleArchive: () => void;
  getRowContent: (item: T) => ConventionRowContent;
  onOpen: (item: T) => void;
  deleteLabel: string;
  onDelete: (item: T) => void;
  archiveItemLabel: string;
  onArchive: (item: T) => void;
  onOpenActions: (item: T) => void;
}

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
  deleteLabel,
  onDelete,
  archiveItemLabel,
  onArchive,
  onOpenActions,
}: ConventionListProps<T>) {
  const colorScheme = useColorScheme();

  function renderConvention(item: T, isArchived = false) {
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
        {/*
          The row and its actions button are siblings, not nested. A Button
          inside a Button gives SwiftUI two overlapping tap targets and the
          inner one wins inconsistently, so the row would sometimes open the
          convention and sometimes open the sheet.
        */}
        <HStack spacing={4} modifiers={[frame({ maxWidth: Infinity })]}>
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
                  modifiers={[font({ textStyle: "body", weight: "semibold" })]}
                >
                  {row.name}
                </Text>
                <VStack alignment="leading" spacing={2}>
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
                        style: row.status === "ended" ? "secondary" : "primary",
                      }),
                    ]}
                  >
                    {row.statusLabel}
                  </Text>
                </VStack>
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
          {/*
            The same actions the swipe offers, as a button. Swipe alone is
            invisible until discovered, and it is awkward under VoiceOver and
            out of reach under Switch Control — so it cannot be the only way
            to archive or delete a convention.
          */}
          <Button
            systemImage="ellipsis.circle"
            onPress={() => onOpenActions(item)}
            modifiers={[
              buttonStyle("borderless"),
              frame({ width: 44, height: 44 }),
              contentShape(shapes.rectangle()),
              accessibilityLabel(row.moreAccessibilityLabel),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          />
        </HStack>
        {!isArchived ? (
          <SwipeActions.Actions edge="leading" allowsFullSwipe>
            <Button
              label={archiveItemLabel}
              systemImage="archivebox"
              onPress={() => onArchive(item)}
            />
          </SwipeActions.Actions>
        ) : null}
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
  }

  return (
    <Host
      colorScheme={colorScheme === "dark" ? "dark" : "light"}
      style={{ flex: 1 }}
    >
      <List modifiers={[listStyle("plain")]}>
        {data.length === 0 && archivedData.length > 0 ? (
          <Text
            modifiers={[
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              padding({ vertical: 12 }),
            ]}
          >
            {currentEmptyLabel}
          </Text>
        ) : null}
        {data.map((item) => renderConvention(item))}
        {archivedData.length > 0 ? (
          <Button
            onPress={onToggleArchive}
            modifiers={[
              buttonStyle("plain"),
              accessibilityLabel(`${archiveLabel}, ${archiveActionLabel}`),
              listRowInsets({
                top: 0,
                leading: 16,
                bottom: 0,
                trailing: 16,
              }),
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
              <Text
                modifiers={[font({ textStyle: "body", weight: "semibold" })]}
              >
                {archiveLabel}
              </Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ textStyle: "caption" }),
                  foregroundStyle({
                    type: "hierarchical",
                    style: "secondary",
                  }),
                ]}
              >
                {archiveActionLabel}
              </Text>
            </HStack>
          </Button>
        ) : null}
        {archiveExpanded
          ? archivedData.map((item) => renderConvention(item, true))
          : null}
      </List>
    </Host>
  );
}
