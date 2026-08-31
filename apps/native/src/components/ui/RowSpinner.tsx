import { ActivityIndicator } from "react-native";

/**
 * The busy indicator for a `ListItem`'s trailing slot.
 *
 * iOS keeps React Native's `ActivityIndicator`: the row is a SwiftUI `List`
 * row hosting RN views, which measures them the way any RN layout would.
 *
 * Android needs its own version -- see `RowSpinner.android.tsx`.
 */
export function RowSpinner() {
  return <ActivityIndicator size="small" />;
}
