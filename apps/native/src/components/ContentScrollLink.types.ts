import type { ViewProps } from "react-native";

/**
 * Wraps an `@expo/ui` `Host` whose SwiftUI list should drive the screen's
 * navigation bar: the large title collapses and the bar's background changes
 * as the list scrolls. See `ConPawsContentScrollLink.swift`.
 */
export type ContentScrollLinkProps = ViewProps;
