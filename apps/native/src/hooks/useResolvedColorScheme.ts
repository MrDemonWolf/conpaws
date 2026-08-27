import { useColorScheme } from "react-native";

/**
 * The device appearance narrowed to the two values Expo UI accepts.
 *
 * `useColorScheme()` is nullable -- it returns null until the OS has reported
 * an appearance -- but every `<Host>` needs a concrete scheme or its SwiftUI
 * and Jetpack Compose subtrees render against the wrong palette. Light is the
 * right default for the unknown case, because it is what both platforms fall
 * back to themselves.
 *
 * This lives in one place so that honouring the in-app appearance override at
 * these boundaries is a single edit rather than a sweep of every `<Host>`.
 */
export function useResolvedColorScheme(): "dark" | "light" {
  return useColorScheme() === "dark" ? "dark" : "light";
}
