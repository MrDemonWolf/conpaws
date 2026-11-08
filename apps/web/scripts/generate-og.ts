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

// Brand: website dark appearance, with the real app screen as the product image.
const NAVY = "#0b0d11";
const SURFACE = "#14181e";
const BORDER = "#343b45";
const SKY = "#0faced";
const SKY_GLOW = "#17627b";
const WHITE = "#f4f8ff";
const MUTED = "#aab1bb";

const FONT = "'DejaVu Sans', Verdana, 'Helvetica Neue', Arial, sans-serif";

// The mark's viewBox is 130 units square; this is the box it fills on the card.
const MARK = { x: 78, y: 58, size: 54 };

const APP_SCREEN = { x: 785, y: 12, width: 393, height: 855 };

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
  const appScreen = readFileSync(
    fileURLToPath(
      new URL("../public/app-preview/browse-dark.png", import.meta.url),
    ),
  ).toString("base64");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="0%" cy="0%" r="72%">
      <stop offset="0" stop-color="${SKY_GLOW}" stop-opacity="0.2"/>
      <stop offset="1" stop-color="${SKY_GLOW}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="app-screen"><rect x="${APP_SCREEN.x}" y="${APP_SCREEN.y}" width="${APP_SCREEN.width}" height="${APP_SCREEN.height}" rx="18"/></clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <g transform="translate(${MARK.x} ${MARK.y}) scale(${scale}) translate(-35 -34)" fill="${SKY}">${markPaths()}</g>
  <text x="148" y="98" font-family="${FONT}" font-size="38" font-weight="700" fill="${WHITE}">ConPaws</text>
  <text x="78" y="214" font-family="${FONT}" font-size="17" font-weight="700" letter-spacing="4" fill="${SKY}">YOUR CONVENTION COMPANION</text>
  <text x="78" y="306" font-family="${FONT}" font-size="62" font-weight="700" fill="${WHITE}">Your con schedule.</text>
  <text x="78" y="376" font-family="${FONT}" font-size="62" font-weight="700" fill="${SKY}">Ready offline.</text>
  <text x="80" y="438" font-family="${FONT}" font-size="25" fill="${MUTED}">Browse panels. Star what matters.</text>
  <text x="80" y="475" font-family="${FONT}" font-size="25" fill="${MUTED}">Keep your plan ready offline.</text>
  <text x="80" y="548" font-family="${FONT}" font-size="17" font-weight="700" letter-spacing="3.5" fill="${SKY}">BROWSE · PLAN · GO OFFLINE</text>
  <text x="80" y="589" font-family="${FONT}" font-size="18" fill="${MUTED}">conpaws.com</text>
  <rect x="${APP_SCREEN.x}" y="${APP_SCREEN.y}" width="${APP_SCREEN.width}" height="${APP_SCREEN.height}" rx="18" fill="${SURFACE}" stroke="${BORDER}" stroke-width="2"/>
  <image href="data:image/png;base64,${appScreen}" x="${APP_SCREEN.x + 2}" y="${APP_SCREEN.y + 2}" width="${APP_SCREEN.width - 4}" height="${APP_SCREEN.height - 4}" preserveAspectRatio="xMidYMid slice" clip-path="url(#app-screen)"/>
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
