import { CircularProgressIndicator } from "@expo/ui/jetpack-compose";
import { size } from "@expo/ui/jetpack-compose/modifiers";

/**
 * The busy indicator for a `ListItem`'s trailing slot, on Android.
 *
 * THE PROBLEM
 *
 * A `ListItem`'s trailing slot is a Compose slot. Putting a React Native view
 * in it -- `<ActivityIndicator />` -- hands Compose a child it cannot measure,
 * so the view host takes the full width it is offered. The trailing slot then
 * eats the row, and the headline is squeezed to a single character per line:
 * the import screen's "Loading Schedule" rendered as a vertical column of
 * letters.
 *
 * THE FIX
 *
 * Use Compose's own indicator, which the slot can measure. 24dp is Material's
 * own size for a `ListItem` trailing icon, and it is set explicitly because an
 * indeterminate indicator otherwise reports no intrinsic size of its own.
 */
export function RowSpinner() {
  return <CircularProgressIndicator modifiers={[size(24, 24)]} />;
}
