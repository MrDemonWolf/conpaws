import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type MaterialThemeColors,
  materialNavigationColors,
  materialThemeVariables,
} from "./material-theme";

const metroConfig = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../metro.config.js"),
  "utf8",
);

// Distinct values make an accidental swap of surface/content roles visible.
const palette = {
  surface: "#111111FF",
  onSurface: "#EEEEEEFF",
  surfaceContainer: "#222222FF",
  surfaceContainerHigh: "#333333FF",
  onSurfaceVariant: "#CCCCCCFF",
  secondaryContainer: "#444444FF",
  onSecondaryContainer: "#DDDDDDFF",
  outlineVariant: "#555555FF",
  error: "#AA0000FF",
} satisfies MaterialThemeColors;

describe("Android Material theme bridge", () => {
  it("uses the same surface for the navigator, screen, and Compose FieldGroup", () => {
    const navigation = materialNavigationColors(palette);
    const css = materialThemeVariables(palette);

    expect(navigation.background).toBe(palette.surface);
    expect(navigation.card).toBe(css["--color-background"]);
    expect(navigation.text).toBe(css["--color-foreground"]);
    expect(css["--color-card"]).toBe(palette.surfaceContainer);
    expect(css["--color-card-foreground"]).toBe(palette.onSurface);
  });

  it("keeps every runtime color variable out of NativeWind's inliner", () => {
    const excluded = new Set(
      [...metroConfig.matchAll(/"(--color-[\w-]+)"/g)].map((match) => match[1]),
    );

    for (const name of Object.keys(materialThemeVariables(palette))) {
      expect(excluded.has(name), `${name} was inlined`).toBe(true);
    }
  });
});
