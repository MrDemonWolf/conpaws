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
  const hex = [
    ...block.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "gi")),
  ].at(-1)?.[1];
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

describe.each([
  ["light", /:root\s*\{([\s\S]*?)\}/, /html\.light\s*\{([\s\S]*?)\}/],
  ["dark", /\.dark\s*\{([\s\S]*?)\}/, /html\.dark\s*\{([\s\S]*?)\}/],
] as const)("website %s surfaces", (_, sharedPattern, websitePattern) => {
  const websiteCss = readFileSync(
    new URL("../index.css", import.meta.url),
    "utf8",
  );
  const sharedTheme = css.match(sharedPattern)?.[1];
  const websiteTheme = websiteCss.match(websitePattern)?.[1];
  if (!sharedTheme || !websiteTheme) throw new Error("Missing website theme");
  const resolved = `${sharedTheme}\n${websiteTheme}`;

  it("keeps website surfaces and supporting text neutral", () => {
    for (const name of [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive-foreground",
      "border",
      "input",
    ]) {
      const [red, green, blue] = color(resolved, name);
      expect(red, name).toBe(green);
      expect(green, name).toBe(blue);
    }
  });

  it("keeps foreground pairs readable on page, raised and supporting surfaces", () => {
    for (const surface of [
      "background",
      "card",
      "popover",
      "secondary",
      "muted",
      "accent",
    ])
      for (const text of ["foreground", "muted-foreground"])
        expect(
          contrast(color(resolved, surface), color(resolved, text)),
        ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps paired actions and semantic text readable on the website", () => {
    for (const name of ["primary", "destructive"])
      expect(
        contrast(color(resolved, name), color(resolved, `${name}-foreground`)),
      ).toBeGreaterThanOrEqual(4.5);
    for (const surface of ["background", "card", "secondary", "muted"]) {
      const backdrop = color(resolved, surface);
      for (const name of ["primary", "destructive"]) {
        const fill = color(resolved, name);
        expect(contrast(fill, backdrop)).toBeGreaterThanOrEqual(4.5);
        const hover: Rgb = [
          fill[0] * 0.9 + backdrop[0] * 0.1,
          fill[1] * 0.9 + backdrop[1] * 0.1,
          fill[2] * 0.9 + backdrop[2] * 0.1,
        ];
        expect(
          contrast(hover, color(resolved, `${name}-foreground`)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps input boundaries visible on page and card", () => {
    for (const surface of ["background", "card"])
      expect(
        contrast(color(resolved, surface), color(resolved, "input")),
      ).toBeGreaterThanOrEqual(3);
  });

  it("keeps focus rings visible on page and supporting surfaces", () => {
    for (const surface of ["background", "card", "secondary", "muted"])
      expect(
        contrast(color(resolved, surface), color(resolved, "ring")),
      ).toBeGreaterThanOrEqual(3);
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
