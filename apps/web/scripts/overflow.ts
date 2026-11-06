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

const WIDTHS = [320, 375, 768, 1024, 1280];
const localePaths = LOCALE_CODES.map((locale) =>
  locale === "en" ? "/" : `/${locale}`,
);
const paths = [
  ...localePaths,
  "/privacy",
  "/terms",
  "/support",
  "/updates",
  "/confirmed",
  "/design-system",
];

const browser = await chromium.launch();
const failures: string[] = [];
try {
  const fallback = await browser.newPage({
    javaScriptEnabled: false,
    colorScheme: "light",
  });
  await fallback.goto(origin.toString(), { waitUntil: "load" });
  assert(
    await fallback.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
    "Before JavaScript, the server must keep the dark fallback",
  );
  assert.equal(
    await fallback.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    ),
    "rgb(0, 0, 0)",
    "The fallback canvas must be dark before theme hydration",
  );
  await fallback.close();

  const appearance = await browser.newPage({ colorScheme: "dark" });
  await appearance.goto(origin.toString(), { waitUntil: "load" });
  for (const colorScheme of ["dark", "light", "dark"] as const) {
    await appearance.emulateMedia({ colorScheme });
    await appearance.waitForFunction(
      (theme) => document.documentElement.classList.contains(theme),
      colorScheme,
    );
    assert.equal(
      await appearance.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      ),
      colorScheme === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)",
      "The hydrated page must follow system appearance changes",
    );
    const glass = await appearance.evaluate(() => {
      const header = document.querySelector("header");
      if (!header) throw new Error("Missing site header");
      const style = getComputedStyle(header);
      return {
        supported:
          CSS.supports(
            "background",
            "color-mix(in srgb, black 85%, transparent)",
          ) &&
          (CSS.supports("backdrop-filter", "blur(1px)") ||
            CSS.supports("-webkit-backdrop-filter", "blur(1px)")),
        filter:
          style.backdropFilter ||
          style.getPropertyValue("-webkit-backdrop-filter"),
      };
    });
    assert.equal(glass.filter, glass.supported ? "blur(18px)" : "none");
    for (const preference of [
      { contrast: "more" },
      { contrast: "no-preference", forcedColors: "active" },
    ] as const) {
      await appearance.emulateMedia(preference);
      const opaque = await appearance.locator("header").evaluate((header) => {
        const style = getComputedStyle(header);
        return {
          filter:
            style.backdropFilter ||
            style.getPropertyValue("-webkit-backdrop-filter"),
          background: style.backgroundColor,
          canvas: getComputedStyle(document.documentElement).backgroundColor,
        };
      });
      assert.equal(
        opaque.filter,
        "none",
        "Accessibility preferences remove blur",
      );
      assert.equal(
        opaque.background,
        opaque.canvas,
        "Header fallback stays solid",
      );
    }
    await appearance.emulateMedia({
      contrast: "no-preference",
      forcedColors: "none",
    });
  }

  const picker = appearance.locator("footer").getByRole("combobox", {
    name: "Appearance",
  });
  await picker.selectOption("light");
  await appearance.waitForFunction(() =>
    document.documentElement.classList.contains("light"),
  );
  await appearance.reload({ waitUntil: "load" });
  await appearance.waitForFunction(
    () =>
      document.querySelector<HTMLSelectElement>("footer select")?.value ===
      "light",
  );
  assert.equal(
    await picker.inputValue(),
    "light",
    "The choice survives reload",
  );
  assert(
    await appearance.evaluate(() =>
      document.documentElement.classList.contains("light"),
    ),
    "An explicit choice overrides the dark system preference",
  );
  await picker.selectOption("system");
  await appearance.waitForFunction(() =>
    document.documentElement.classList.contains("dark"),
  );
  await appearance.close();

  const layouts = [
    ...WIDTHS.map((width) => ({ width, textScale: 1, paths })),
    ...[320, 1024].map((width) => ({
      width,
      textScale: 2,
      paths: localePaths,
    })),
  ];
  for (const layout of layouts) {
    const page = await browser.newPage({
      viewport: { width: layout.width, height: 800 },
      reducedMotion: "reduce",
    });
    for (const path of layout.paths) {
      // Not "networkidle": Turnstile and the service worker keep polling.
      await page.goto(new URL(path, origin).toString(), { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      if (layout.textScale === 2) {
        await page.evaluate(() => {
          // Simulate text-only enlargement, including fixed-pixel font sizes.
          // Snapshot first so nested relative sizes are not multiplied twice.
          const fonts = Array.from(
            document.querySelectorAll<HTMLElement>("body, body *"),
            (element) => ({
              element,
              size: Number.parseFloat(getComputedStyle(element).fontSize),
            }),
          );
          for (const { element, size } of fonts)
            element.style.fontSize = `${size * 2}px`;
        });
      }
      await page.waitForFunction(() => {
        const header = document.querySelector("header");
        if (!header) return true;
        const height = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--site-header-height",
          ),
        );
        return Math.abs(height - header.getBoundingClientRect().height) < 1;
      });
      const result = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const scrolls = document.documentElement.scrollWidth > viewport;
        const offenders: string[] = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        while (walker.nextNode() && offenders.length < 8) {
          const node = walker.currentNode;
          const element = node.parentElement;
          if (!element || !node.textContent?.trim()) continue;
          if (
            element.closest("script, style, .sr-only, dialog:not([open])") ||
            getComputedStyle(element).visibility === "hidden"
          )
            continue;
          const details = element.closest("details:not([open])");
          if (details && !details.querySelector("summary")?.contains(element))
            continue;
          const control = element.closest("a, button, summary, label");
          const decoration = element.closest('[aria-hidden="true"]');
          if (decoration && !control?.contains(decoration)) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const fragments = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0 && rect.height > 0,
          );
          if (!fragments.length) continue;
          let scrollX = false;
          let scrollY = false;
          let parent: Element | null = element;
          while (parent) {
            const style = getComputedStyle(parent);
            const rect = parent.getBoundingClientRect();
            const clipX = !scrollX && /^(hidden|clip)$/.test(style.overflowX);
            const clipY = !scrollY && /^(hidden|clip)$/.test(style.overflowY);
            if (
              fragments.some(
                (text) =>
                  (clipX &&
                    (text.left < rect.left - 1 ||
                      text.right > rect.right + 1)) ||
                  (clipY &&
                    (text.top < rect.top - 1 || text.bottom > rect.bottom + 1)),
              )
            ) {
              offenders.push(
                `${parent.tagName.toLowerCase()}: clipped ${node.textContent.trim().slice(0, 48)}`,
              );
              break;
            }
            scrollX ||= /^(auto|scroll)$/.test(style.overflowX);
            scrollY ||= /^(auto|scroll)$/.test(style.overflowY);
            parent = parent.parentElement;
          }
          if (control) {
            const rect = control.getBoundingClientRect();
            // Font ink may extend above a line box; real vertical clipping is checked above.
            if (
              fragments.some(
                (text) =>
                  text.left < rect.left - 1 || text.right > rect.right + 1,
              )
            )
              offenders.push(
                `${control.tagName.toLowerCase()}: label exceeds control ${node.textContent.trim().slice(0, 48)}`,
              );
          }
        }
        const target = document.getElementById("features");
        target?.scrollIntoView({ block: "start", behavior: "instant" });
        const header = document.querySelector("header");
        const anchorCovered =
          target && header
            ? target.getBoundingClientRect().top <
              header.getBoundingClientRect().bottom - 1
            : false;
        return { scrolls, offenders, anchorCovered };
      });
      if (result.scrolls || result.offenders.length || result.anchorCovered) {
        failures.push(
          `${layout.width}px ${layout.textScale * 100}% text ${path}: horizontal scroll=${result.scrolls}, covered anchor=${result.anchorCovered}; ${result.offenders.join("; ")}`,
        );
      }
      if (layout.width === 320 && layout.textScale === 2) {
        await page.locator('header button[aria-haspopup="dialog"]').click();
        const appearanceIssues = await page
          .locator("dialog[open]")
          .getByRole("combobox")
          .evaluate((select) => {
            const label = select.closest("label");
            const text = label?.querySelector("span");
            if (!label || !text) throw new Error("Missing appearance label");
            const bounds = label.getBoundingClientRect();
            const outside = (rect: DOMRect) =>
              rect.left < bounds.left - 1 ||
              rect.right > bounds.right + 1 ||
              rect.top < bounds.top - 1 ||
              rect.bottom > bounds.bottom + 1;
            const range = document.createRange();
            range.selectNodeContents(text);
            const control = select.getBoundingClientRect();
            const issues: string[] = [];
            if (label.scrollWidth > label.clientWidth + 1)
              issues.push("appearance label scrolls horizontally");
            if (Array.from(range.getClientRects()).some(outside))
              issues.push("appearance text exceeds its label");
            if (outside(control))
              issues.push("appearance picker exceeds its label");
            if (control.width < 44 || control.height < 44)
              issues.push("appearance picker target is smaller than 44px");
            return issues;
          });
        if (appearanceIssues.length)
          failures.push(
            `320px 200% text ${path}: ${appearanceIssues.join("; ")}`,
          );
        await page.keyboard.press("Escape");
      }
    }
    await page.close();
  }

  // The redesigned header and manual preview selector must remain keyboard
  // usable after hydration, not merely fit in the server-rendered page.
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    reducedMotion: "reduce",
  });
  await page.goto(origin.toString(), { waitUntil: "load" });
  const menu = page.getByRole("button", { name: "Menu: Open navigation" });
  await menu.click();
  const dialog = page.getByRole("dialog", { name: "Menu", exact: true });
  assert(await dialog.isVisible(), "Mobile navigation must open");
  const mobileAppearance = dialog.getByRole("combobox", { name: "Appearance" });
  await mobileAppearance.selectOption("dark");
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("dark"),
  );
  assert(await dialog.isVisible(), "Changing appearance keeps navigation open");
  assert.equal(
    await page.locator("footer select").inputValue(),
    "dark",
    "Menu and footer share the same preference",
  );
  await mobileAppearance.focus();
  await page.keyboard.press("Tab");
  assert(
    await dialog
      .getByRole("link", { name: "Join waitlist" })
      .evaluate((element) => document.activeElement === element),
    "Tab moves from the native appearance picker to the next menu action",
  );
  await mobileAppearance.selectOption("system");
  await dialog.getByRole("link", { name: "ConPaws", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  assert(
    await dialog
      .getByRole("link", { name: "Join waitlist" })
      .evaluate((element) => document.activeElement === element),
    "Shift+Tab must remain inside mobile navigation",
  );
  const language = dialog.locator("details[data-lang-menu]");
  await language.locator("summary").click();
  await page.keyboard.press("Escape");
  assert(
    !(await language.evaluate((element) => element.hasAttribute("open"))) &&
      (await dialog.isVisible()),
    "First Escape closes only the language picker",
  );
  await page.keyboard.press("Escape");
  assert(!(await dialog.isVisible()), "Second Escape closes navigation");
  assert(
    await menu.evaluate((element) => document.activeElement === element),
    "Closing navigation restores the trigger focus",
  );

  await menu.press("Enter");
  await dialog.getByRole("link", { name: "The app", exact: true }).click();
  assert(!(await dialog.isVisible()), "A section link closes navigation");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "inside",
    "A section link moves focus to its content",
  );

  const reminders = page.getByRole("button", {
    name: "Reminders",
    exact: true,
  });
  const previewImage = page.locator('figure img[data-active="true"]');
  const imageBounds = await previewImage.boundingBox();
  const dotBounds = await reminders.boundingBox();
  assert(imageBounds && dotBounds, "Preview and its controls must be visible");
  assert(
    dotBounds.y >= imageBounds.y + imageBounds.height &&
      dotBounds.width >= 44 &&
      dotBounds.height >= 44,
    "Preview controls belong below the image with usable touch targets",
  );
  await reminders.click();
  assert.equal(await reminders.getAttribute("aria-pressed"), "true");
  await reminders.focus();
  await reminders.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("button", { name: "Browse", exact: true })
      .getAttribute("aria-pressed"),
    "true",
    "Preview arrows wrap to Browse",
  );
  await page.keyboard.press("End");
  assert.equal(await reminders.getAttribute("aria-pressed"), "true");
  assert.equal(
    await page
      .locator('figure img[data-active="true"]')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
    "0s",
    "Reduced motion disables the preview crossfade",
  );
  const gallery = page.getByRole("region", {
    name: "App preview screens",
    exact: true,
  });
  await gallery.focus();
  await gallery.press("ArrowRight");
  await page.waitForFunction(
    () =>
      (document.querySelector("section[tabindex='0']")?.scrollLeft ?? 0) > 0,
  );
  await page.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `PASS: ${paths.length} pages at ${WIDTHS.join(", ")}px and all ${localePaths.length} locales with simulated 200% text at320/1024px; no clipped labels, horizontal overflow or covered anchors; appearance, keyboard and preview controls`,
);
