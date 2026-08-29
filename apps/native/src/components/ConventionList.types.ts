export interface ConventionRowContent {
  name: string;
  dateRange: string;
  status: "upcoming" | "active" | "ended";
  statusLabel: string;
  moreAccessibilityLabel: string;
  /**
   * Whether Unarchive is offered for this row — true only for explicitly
   * archived conventions that have not ended (see `canUnarchive` in
   * convention-list.ts for why ended ones are excluded).
   */
  canUnarchive: boolean;
}

export interface ConventionListProps<T extends { id: string }> {
  data: T[];
  archivedData: T[];
  archiveExpanded: boolean;
  archiveLabel: string;
  archiveActionLabel: string;
  currentEmptyLabel: string;
  onToggleArchive: () => void;
  getRowContent: (item: T) => ConventionRowContent;
  onOpen: (item: T) => void;
  onOpenActions: (item: T) => void;
  /**
   * Swipe actions, consumed by the iOS implementation only.
   *
   * iOS draws these as leading and trailing `SwipeActions` on each row. The
   * other platforms render a `FlatList`, which has no swipe affordance, and
   * reach the same two actions through the row's ellipsis button and the
   * action sheet `onOpenActions` opens. They stay required rather than
   * optional because iOS cannot render a row without them, and they are
   * grouped and named here so the next reader does not have to diff the two
   * implementations to discover that the base one ignores them.
   */
  deleteLabel: string;
  onDelete: (item: T) => void;
  archiveItemLabel: string;
  onArchive: (item: T) => void;
  unarchiveItemLabel: string;
  onUnarchive: (item: T) => void;
}
