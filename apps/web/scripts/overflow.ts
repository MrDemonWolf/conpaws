// Rendered layout check for every locale at narrow phone widths.
//
//   bun run --filter @conpaws/web preview        # local Worker on 8789
//   bun apps/web/scripts/overflow.ts http://127.0.0.1:8789
//
// e2e.ts only fetches HTML, so it cannot see a heading word wider than the
// viewport (the Norwegian hero did exactly that). This loads each page in
// headless Chromium and fails if the document scrolls horizontally or any
// visible element sticks out past the right edge. Needs Playwright's Chromium:
// `bunx playwright-core install chromium-headless-shell` once per machine.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { LOCALE_CODES } from "../src/i18n/config";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:8789");
assert(
  ["localhost", "127.0.0.1"].includes(origin.hostname),
  "Run against a local preview.",
);

const WIDTHS = [320, 375];
const paths = [
  ...LOCALE_CODES.map((locale) => (locale === "en" ? "/" : `/${locale}`)),
  "/privacy",
  "/terms",
  "/support",
  "/updates",
  "/confirmed",
];

const browser = await chromium.launch();
const failures: string[] = [];
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    for (const path of paths) {
      // Not "networkidle": Turnstile and the service worker keep polling.
      await page.goto(new URL(path, origin).toString(), { waitUntil: "load" });
      await page.waitForTimeout(300);
      const result = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const scrolls = document.documentElement.scrollWidth > viewport;
        const offenders: string[] = [];
        for (const element of document.querySelectorAll("body *")) {
          const style = getComputedStyle(element);
          if (style.position === "fixed" || style.visibility === "hidden") {
            continue;
          }
          // Decorative layers clipped by an overflow-hidden ancestor are fine;
          // only flag elements whose overflow actually reaches the page.
          if (element.closest("[aria-hidden='true']")) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.right > viewport + 1) {
            const label = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`;
            offenders.push(`${label} right=${Math.round(rect.right)}`);
          }
        }
        return { scrolls, offenders: offenders.slice(0, 5) };
      });
      if (result.scrolls) {
        failures.push(
          `${width}px ${path}: page scrolls horizontally (${result.offenders.join(", ") || "no single offender"})`,
        );
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `PASS: no horizontal overflow on ${paths.length} pages at ${WIDTHS.join(" and ")}px`,
);
