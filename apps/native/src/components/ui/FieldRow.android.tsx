import type { ListItemProps } from "@expo/ui";
import { ListItem as ComposeListItem, Text } from "@expo/ui/jetpack-compose";
import { clickable } from "@expo/ui/jetpack-compose/modifiers";
import { Children, type ReactNode } from "react";

/**
 * A row inside a `FieldGroup.Section`, drawn with a single Material surface.
 *
 * THE PROBLEM
 *
 * Android drew every settings row as a card inside a card, in two different
 * tones, with a visible seam. `FieldGroup.Section` wraps each of its children in
 * its own Compose `ListItem` to get the Material 3 connected-list look:
 *
 *   // @expo/ui/src/universal/FieldGroup/FieldSection.android.tsx
 *   <ListItem colors={{ containerColor: colors.surfaceContainer }}
 *             modifiers={[fillMaxWidth(), clip(...)]}>
 *     <ListItem.HeadlineContent>{child}</ListItem.HeadlineContent>
 *   </ListItem>
 *
 * The child we hand it is `@expo/ui`'s universal `ListItem`, whose Android
 * implementation renders a *second* Compose `ListItem` and never forwards
 * `colors`, so the inner one keeps `ListItemDefaults.colors()` —
 * `containerColor: surface` — inside the outer `surfaceContainer`. Two fills,
 * one row.
 *
 * Rows built from `Switch` were unaffected, because they are not `ListItem`s
 * and so only ever got the section's single wrapper. That inconsistency inside
 * one group is what made it read as a bug rather than a style.
 *
 * THE FIX
 *
 * Go straight to `@expo/ui/jetpack-compose`'s `ListItem`, which *does* accept
 * `colors`, and make the inner surface transparent so the section's own fill —
 * the one carrying the grouped corner radii and the 2dp gaps — is the only one
 * that paints.
 *
 * Nothing else here differs from what the universal component does on Android:
 * the slot mapping and the string wrapping are the same, because Compose hosts
 * cannot render raw strings.
 *
 * WHY NOT SOMETHING SIMPLER
 *
 * - `modifiers` on the section reach its outer `Column`, not the per-row
 *   `ListItem`s. Built and checked on device: no change.
 * - `Modifier.background` cannot win — Material's `ListItem` paints its own
 *   `Surface` over anything drawn behind it.
 * - There is no newer package to take. `@expo/ui@latest` is 57.0.14, which is
 *   what we ship.
 *
 * Upstream: https://github.com/expo/expo/issues/49540. Delete this file and go
 * back to the universal `ListItem` when that is fixed.
 *
 * `testID` is accepted and dropped, matching the universal component's Android
 * behaviour — it does not forward it either.
 */

// Compose hosts cannot render raw strings; they need a `Text` composable.
function wrapStrings(node: ReactNode): ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string" || typeof node === "number") {
    return <Text>{node}</Text>;
  }
  if (Array.isArray(node)) return Children.map(node, wrapStrings);
  return node;
}

export function FieldRow({
  children,
  onPress,
  leading,
  trailing,
  supportingText,
  modifiers,
}: ListItemProps) {
  const itemModifiers = [
    ...(onPress ? [clickable(onPress)] : []),
    ...(modifiers ?? []),
  ];

  return (
    <ComposeListItem
      colors={{ containerColor: "transparent" }}
      modifiers={itemModifiers.length ? itemModifiers : undefined}
    >
      <ComposeListItem.HeadlineContent>
        <>{wrapStrings(children)}</>
      </ComposeListItem.HeadlineContent>
      {supportingText != null ? (
        <ComposeListItem.SupportingContent>
          {wrapStrings(supportingText)}
        </ComposeListItem.SupportingContent>
      ) : null}
      {leading != null ? (
        <ComposeListItem.LeadingContent>
          {wrapStrings(leading)}
        </ComposeListItem.LeadingContent>
      ) : null}
      {trailing != null ? (
        <ComposeListItem.TrailingContent>
          {wrapStrings(trailing)}
        </ComposeListItem.TrailingContent>
      ) : null}
    </ComposeListItem>
  );
}
