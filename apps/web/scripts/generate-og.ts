// Regenerates the social card at public/og.png.
//
//   bun apps/web/scripts/generate-og.ts            # write public/<OG_IMAGE_PATH>
//   bun apps/web/scripts/generate-og.ts out.png    # write somewhere else
//
// The mark is NOT drawn here. It is read out of src/app/icon.svg, which is the
// official compass-and-paw traced from the app icon
// (apps/native/assets/images/ConPaws.icon/Assets/logo.png). The earlier card
// was hand-built and carried an approximation of the logo; reading the path
// from the one traced source means the card, the favicon and the site cannot
// drift apart again.
//
// Rendering is headless Chromium through playwright-core, which the repo
// already uses for check:overflow (`bunx playwright-core install
// chromium-headless-shell` once per machine). Text uses a system sans stack, so
// glyph shapes differ slightly between machines; review the PNG before
// committing it.
//
// Link-preview scrapers cache by URL, so a changed card does not refresh
// previews that were already shared; re-scrape them in the platform debuggers.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { OG_IMAGE_PATH } from "../src/lib/root-metadata";

const WIDTH = 1200;
const HEIGHT = 630;

// Brand: packages/ui globals.css. Navy field, sky primary.
const NAVY = "#091533";
const SURFACE = "#0f1d45";
const BORDER = "#1e3a5f";
const SKY = "#0faced";
const SKY_GLOW = "#0faced";
const WHITE = "#f4f8ff";
const MUTED = "#aab9e1";

const FONT = "'DejaVu Sans', Verdana, 'Helvetica Neue', Arial, sans-serif";

// The mark's viewBox is 130 units square; this is the box it fills on the card.
const MARK = { x: 155, y: 193, size: 244 };

/** Path data of the official mark, taken verbatim from icon.svg. */
function markPaths(): string {
  const svg = readFileSync(
    fileURLToPath(new URL("../src/app/icon.svg", import.meta.url)),
    "utf8",
  );
  const body = svg.match(/<g\b[^>]*>([\s\S]*?)<\/g>/)?.[1];
  if (!body?.includes("<path")) {
    throw new Error("src/app/icon.svg no longer contains the mark's <g> paths");
  }
  return body;
}

function cardSvg(): string {
  const scale = MARK.size / 130;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="glow-tl" cx="14%" cy="0%" r="55%">
      <stop offset="0" stop-color="${SKY_GLOW}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${SKY_GLOW}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-br" cx="100%" cy="100%" r="45%">
      <stop offset="0" stop-color="${SKY_GLOW}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${SKY_GLOW}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow-tl)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow-br)"/>
  <rect x="70" y="62" width="1060" height="506" rx="32" fill="${SURFACE}" stroke="${BORDER}" stroke-width="2"/>
  <rect x="70" y="62" width="1060" height="8" rx="4" fill="${SKY}"/>
  <rect x="556" y="88" width="88" height="14" rx="7" fill="${NAVY}" stroke="${BORDER}" stroke-width="2"/>
  <g transform="translate(${MARK.x} ${MARK.y}) scale(${scale}) translate(-35 -34)" fill="${SKY}">${markPaths()}</g>
  <text x="474" y="309" font-family="${FONT}" font-size="112" font-weight="700" fill="${WHITE}">ConPaws</text>
  <text x="474" y="384" font-family="${FONT}" font-size="41" fill="${MUTED}">Your con schedule, sorted.</text>
  <rect x="474" y="438" width="52" height="4" rx="2" fill="${SKY}"/>
  <text x="474" y="493" font-family="${FONT}" font-size="28" font-weight="700" letter-spacing="4.5" fill="${SKY}">iOS · Android · conpaws.com</text>
</svg>`;
}

const out =
  process.argv[2] ??
  fileURLToPath(new URL(`../public${OG_IMAGE_PATH}`, import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><body style="margin:0">${cardSvg()}</body>`,
  );
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(
    out,
    await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    }),
  );
} finally {
  await browser.close();
}
console.log(`wrote ${out}`);
