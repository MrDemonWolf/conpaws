import { ListItem } from "@expo/ui";

/**
 * A row inside a `FieldGroup.Section`: `@expo/ui`'s universal `ListItem`, on
 * both platforms.
 *
 * It must stay that exact component. On Android, `FieldGroup.Section` checks
 * each row's identity: a universal `ListItem` becomes the row itself, with the
 * section's colour, rounded clip and ripple, while anything else is wrapped in
 * a second Compose `ListItem`. A wrapper here, even one that renders a
 * `ListItem`, gets that second surface: double padding and a pressed or
 * hovered outline drawn inside another one. That is what an Android-only
 * wrapper for expo/expo#49540 did once the fix shipped in `@expo/ui` 58.
 */
export const FieldRow = ListItem;
