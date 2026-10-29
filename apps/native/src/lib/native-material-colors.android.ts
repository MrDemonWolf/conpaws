import { getMaterialColors } from "@expo/ui/jetpack-compose";
import { themeTokens } from "./theme-tokens";

/** Match the seed and resolved appearance passed to each branded Expo UI Host. */
export function getNativeMaterialColors(scheme: "light" | "dark") {
  return getMaterialColors({ scheme, seedColor: themeTokens[scheme].primary });
}
