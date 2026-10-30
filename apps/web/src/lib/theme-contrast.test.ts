import { readFileSync } from "node:fs";
import { Badge } from "@conpaws/ui/components/badge";
import { buttonVariants } from "@conpaws/ui/components/button";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../../../packages/ui/src/styles/globals.css", import.meta.url),
  "utf8",
);

type Rgb = [number, number, number];

function color(block: string, name: string): Rgb {
  const hex = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!hex) throw new Error(`Missing --${name}`);
  const channel = (offset: number) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return [channel(1), channel(3), channel(5)];
}

function luminance(channels: Rgb): number {
  const linear = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * linear(channels[0]) +
    0.7152 * linear(channels[1]) +
    0.0722 * linear(channels[2])
  );
}

function contrast(first: Rgb, second: Rgb): number {
  const firstLight = luminance(first);
  const secondLight = luminance(second);
  return (
    (Math.max(firstLight, secondLight) + 0.05) /
    (Math.min(firstLight, secondLight) + 0.05)
  );
}

describe.each([
  ["light", /:root\s*\{([\s\S]*?)\}/],
  ["dark", /\.dark\s*\{([\s\S]*?)\}/],
] as const)("shared web %s theme", (_, pattern) => {
  const block = css.match(pattern)?.[1];
  if (!block) throw new Error(`Missing theme: ${pattern}`);

  it("keeps filled action labels above AA contrast", () => {
    for (const name of ["primary", "destructive"]) {
      expect(
        contrast(color(block, name), color(block, `${name}-foreground`)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps destructive button hover labels above AA on page and card", () => {
    for (const surface of ["background", "card"]) {
      const backdrop = color(block, surface);
      const fill = color(block, "destructive");
      const hover: Rgb = [
        fill[0] * 0.9 + backdrop[0] * 0.1,
        fill[1] * 0.9 + backdrop[1] * 0.1,
        fill[2] * 0.9 + backdrop[2] * 0.1,
      ];
      expect(
        contrast(hover, color(block, "destructive-foreground")),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

it("uses the tested foreground pair for destructive Button and Badge", () => {
  expect(css).toContain(
    "--color-destructive-foreground: var(--destructive-foreground)",
  );
  expect(buttonVariants({ variant: "destructive" })).toContain(
    "text-destructive-foreground",
  );
  const badge = renderToStaticMarkup(
    createElement(Badge, { variant: "destructive" }, "Delete"),
  );
  expect(badge).toContain("text-destructive-foreground");
  expect(badge).not.toContain("text-white");
});
