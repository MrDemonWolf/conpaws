import { ListItem } from "@expo/ui";

/**
 * A row inside a `FieldGroup.Section`.
 *
 * iOS gets `@expo/ui`'s universal `ListItem` unchanged — SwiftUI's `Form`
 * renders one grouped card with hairline dividers and there is nothing to fix.
 * See the `.android.ts` sibling for what Android needs and why.
 */
export const FieldRow = ListItem;
