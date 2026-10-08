/**
 * A stable accent colour per category name, for the bar on the left of a
 * schedule row and the kicker on the detail sheet.
 *
 * Feeds invent their own categories, so there is no fixed list to map. A hash
 * of the name picks one of eight accents, which keeps "Art" the same colour on
 * every screen and every launch. The accents are decoration: the category is
 * always also written out, and the cluster edge that marks an overlap stays
 * the primary colour, so nothing is said by hue alone.
 *
 * Every accent clears 3:1 against both the page and card backgrounds of its
 * scheme (asserted by category-color.test.ts), which is WCAG's floor for a
 * non-text mark.
 */

export type ColorScheme = "light" | "dark";

export const CATEGORY_ACCENTS: Record<ColorScheme, readonly string[]> = {
  light: [
    "#7b55c0",
    "#2b7a75",
    "#a3642a",
    "#4766ad",
    "#b0566a",
    "#8f5a85",
    "#5c7a27",
    "#b2512c",
  ],
  dark: [
    "#c0a6f5",
    "#79d1cb",
    "#e6b068",
    "#9bb8f2",
    "#eca2ab",
    "#dcaccf",
    "#b3d072",
    "#f0aa86",
  ],
};

/** FNV-1a over the normalised name; cheap, stable, and spread well enough. */
function hashName(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index++) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Which of the eight accents a category gets, or null when there is none. */
export function categoryAccentIndex(
  name: string | null | undefined,
): number | null {
  if (!name) return null;
  const normalized = normalizeCategoryName(name);
  if (!normalized) return null;
  return hashName(normalized) % CATEGORY_ACCENTS.light.length;
}

export function categoryAccentColor(
  name: string | null | undefined,
  scheme: ColorScheme,
): string | null {
  const index = categoryAccentIndex(name);
  return index === null ? null : CATEGORY_ACCENTS[scheme][index];
}
