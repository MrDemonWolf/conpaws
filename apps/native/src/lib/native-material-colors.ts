import type { MaterialColors } from "@expo/ui/jetpack-compose";

/** iOS and web keep their existing native/semantic palettes. */
export function getNativeMaterialColors(
  _scheme: "light" | "dark",
): MaterialColors | null {
  return null;
}
