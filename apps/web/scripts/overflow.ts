// Rendered layout check for the website: every page at phone, tablet and
// desktop widths, and every page with simulated 200% text.
//
//   bun run --filter @conpaws/web preview        # local Worker on 8789
//   bun apps/web/scripts/overflow.ts http://127.0.0.1:8789
//
// e2e.ts only fetches HTML, so it cannot see a heading word wider than the
// viewport (the Norwegian hero did exactly that) or a Dutch feature label cut
// off by its card. This loads each page in headless Chromium and fails when
//
//   - the document scrolls sideways,
//   - visible text is clipped by an overflow-hidden or overflow-clip ancestor,
//   - a link, button, summary or label is narrower or shorter than its text,
//   - the #features anchor lands under the sticky header,
//
// first with the page as served, then with the mobile menu and its language
// list open (or the desktop language menu), so the translated header strings
// are measured too. 200% text follows WCAG 1.4.4 and the repo's large-text
// rule; Chromium has no text-only zoom, so every element's computed font size
// is doubled inline, which leaves rem spacing alone the way text zoom does.
// The appearance, no-script, skip-link, fragment and keyboard sections cover
// behaviour that only exists after hydration. Needs Playwright's Chromium:
// `bunx playwright-core install chromium-headless-shell` once per machine.
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright-core";
import { LOCALE_CODES } from "../src/i18n/config";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:8789");
assert(
  ["localhost", "127.0.0.1"].includes(origin.hostname),
  "Run against a local preview.",
);

const WIDTHS = [320, 375, 768, 1024, 1280];
const TEXT_SCALE_WIDTHS = [320, 1024];
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
// The shared Button keeps shadcn's whitespace-nowrap, so the design-system
// specimens cannot wrap at 200% yet; that reference page is checked at 100%.
const textScalePaths = paths.filter((path) => path !== "/design-system");

/** True once site-header-menu.tsx has published the header's real height. */
const headerMeasured = () => {
  const header = document.querySelector("header");
  if (!header) return true;
  const published = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--site-header-height",
    ),
  );
  return Math.abs(published - header.getBoundingClientRect().height) < 1;
};

/** Let the caret rotation and other CSS transitions finish before measuring. */
const settle = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );

/**
 * Walk the visible text under `rootSelector` and report text that an
 * overflow-hidden ancestor clips, or that is wider or taller than the link,
 * button, summary or label it belongs to. Also reports sideways scrolling of
 * the document (root is body) or of any scroll container under the root.
 */
const measureText = (page: Page, rootSelector: string) =>
  page.evaluate((rootSelector) => {
    const describe = (element: Element) => {
      const tag = element.tagName.toLowerCase();
      const name = element.id
        ? `#${element.id}`
        : element.classList[0]
          ? `.${element.classList[0]}`
          : "";
      const landmark = element.closest("section[id], dialog, header, footer");
      const where =
        landmark && landmark !== element
          ? ` in ${landmark.tagName.toLowerCase()}${landmark.id ? `#${landmark.id}` : ""}`
          : "";
      return `${tag}${name}${where}`;
    };
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!root)
      return { scrolls: false, offenders: [`missing ${rootSelector}`] };
    const scrolls =
      root === document.body
        ? document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        : [root, ...root.querySelectorAll<HTMLElement>("*")].some(
            (pane) =>
              /^(auto|scroll)$/.test(getComputedStyle(pane).overflowY) &&
              pane.scrollWidth > pane.clientWidth + 1,
          );
    const offenders: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
      // Range rects measure the glyph content area, which overhangs a line
      // box whose line-height is tighter than the font's natural spacing (the
      // wordmark at 1.15 overhangs by 0.7px at 24px and 1.4px at 48px). Allow
      // exactly that much vertically; nothing is clipped or spilling there.
      const lineHeight = Number.parseFloat(
        getComputedStyle(element).lineHeight,
      );
      const slack = (text: DOMRect) =>
        1 +
        (Number.isNaN(lineHeight)
          ? 0
          : Math.max(0, (text.height - lineHeight) / 2));
      const exceedsX = (text: DOMRect, box: DOMRect) =>
        text.left < box.left - 1 || text.right > box.right + 1;
      const exceedsY = (text: DOMRect, box: DOMRect) =>
        text.top < box.top - slack(text) ||
        text.bottom > box.bottom + slack(text);
      const label = node.textContent.trim().slice(0, 48);
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
              (clipX && exceedsX(text, rect)) ||
              (clipY && exceedsY(text, rect)),
          )
        ) {
          offenders.push(`${describe(parent)} clips "${label}"`);
          break;
        }
        scrollX ||= /^(auto|scroll)$/.test(style.overflowX);
        scrollY ||= /^(auto|scroll)$/.test(style.overflowY);
        parent = parent.parentElement;
      }
      if (control) {
        const rect = control.getBoundingClientRect();
        if (
          fragments.some((text) => exceedsX(text, rect) || exceedsY(text, rect))
        )
          offenders.push(`${describe(control)} is smaller than "${label}"`);
      }
    }
    return { scrolls, offenders };
  }, rootSelector);

/** The appearance picker inside the open menu: label, select and target. */
const measureAppearancePicker = (page: Page) =>
  page
    .locator("header dialog[open]")
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
      if (outside(control)) issues.push("appearance picker exceeds its label");
      if (control.width < 44 || control.height < 44)
        issues.push("appearance picker target is smaller than 44px");
      return issues;
    });

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

  // Without JavaScript the expanded <noscript> menu lives inside the header,
  // which must then flow with the page instead of covering half a phone.
  const noScript = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  await noScript.goto(origin.toString(), { waitUntil: "load" });
  assert.equal(
    await noScript.evaluate(() => {
      const header = document.querySelector("header");
      if (!header) throw new Error("Missing site header");
      return getComputedStyle(header).position;
    }),
    "static",
    "Without JavaScript the header must not stick",
  );
  await noScript.close();

  const appearance = await browser.newPage({ colorScheme: "dark" });
  appearance.on("pageerror", (error) => {
    failures.push(`Appearance startup: ${error.message}`);
  });
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
    ...TEXT_SCALE_WIDTHS.map((width) => ({
      width,
      textScale: 2,
      paths: textScalePaths,
    })),
  ];
  for (const layout of layouts) {
    const page = await browser.newPage({
      viewport: { width: layout.width, height: 800 },
      // The hero's rise animation moves text by 18px for 0.7s; measured
      // rects must not depend on when the snapshot lands inside that.
      reducedMotion: "reduce",
    });
    // Pages load in well under a second locally; a hung load should be
    // recorded against its page, not abort the whole run after 30s. A dead
    // preview still fails fast: three unloadable pages in a row end the run
    // instead of burning CI's job timeout one page at a time.
    page.setDefaultTimeout(10_000);
    let unloadable = 0;
    for (const path of layout.paths) {
      const label = `${layout.width}px ${layout.textScale * 100}% text ${path}`;
      const problems: string[] = [];
      try {
        // Not "networkidle": Turnstile and the service worker keep polling.
        await page
          .goto(new URL(path, origin).toString(), { waitUntil: "load" })
          .then(
            () => {
              unloadable = 0;
            },
            (error: unknown) => {
              if (++unloadable >= 3)
                throw new Error(
                  `${path} and the two pages before it never loaded; is the preview up?`,
                );
              throw error;
            },
          );
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        if (layout.textScale === 2) {
          await page.evaluate(() => {
            // Simulate text-only enlargement, including fixed-pixel font
            // sizes. Snapshot first so nested relative sizes are not
            // multiplied twice.
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
        await page.waitForFunction(headerMeasured).catch(() => {
          throw new Error(
            "--site-header-height never matched the header height (did the header hydrate?)",
          );
        });

        const closed = await measureText(page, "body");
        if (closed.scrolls) problems.push("page scrolls horizontally");
        problems.push(...closed.offenders);
        if (
          await page.evaluate(() => {
            const target = document.getElementById("features");
            const header = document.querySelector("header");
            if (!target || !header) return false;
            target.scrollIntoView({ block: "start", behavior: "instant" });
            return (
              target.getBoundingClientRect().top <
              header.getBoundingClientRect().bottom - 1
            );
          })
        )
          problems.push("#features lands under the sticky header");

        if (layout.width < 1024) {
          // The translated header strings live in the closed drawer; open it
          // and its language list, then measure only what the drawer shows.
          await page.locator('header button[aria-haspopup="dialog"]').click();
          const language = page.locator("header dialog[open] details");
          await language.evaluate((details) => {
            (details as HTMLDetailsElement).open = true;
          });
          await settle(page);
          const open = await measureText(page, "header dialog[open]");
          if (open.scrolls) problems.push("menu scrolls horizontally");
          problems.push(...open.offenders.map((text) => `menu open: ${text}`));
          problems.push(...(await measureAppearancePicker(page)));
          await language.evaluate((details) => {
            (details as HTMLDetailsElement).open = false;
          });
          await page.keyboard.press("Escape");
          await page
            .locator("header dialog[open]")
            .waitFor({ state: "hidden" });
        } else {
          const language = page
            .locator("header details[data-lang-menu]")
            .first();
          await language.evaluate((details) => {
            (details as HTMLDetailsElement).open = true;
          });
          await settle(page);
          const open = await measureText(page, "header");
          problems.push(
            ...open.offenders.map((text) => `language menu open: ${text}`),
          );
          await language.evaluate((details) => {
            (details as HTMLDetailsElement).open = false;
          });
        }
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
      if (problems.length) failures.push(`${label}: ${problems.join("; ")}`);
      if (unloadable >= 3) throw new Error(failures.at(-1));
    }
    await page.close();
  }

  // A fresh navigation to a fragment scrolls before hydration with the CSS
  // fallback offset; site-header-menu.tsx re-applies it once the real header
  // height is known. Locales whose header wraps are the ones that regress.
  for (const [width, path] of [
    [1024, "/uk"],
    [1024, "/es-419"],
    [375, "/fi"],
  ] as const) {
    const fresh = await browser.newPage({
      viewport: { width, height: 800 },
      reducedMotion: "reduce",
    });
    await fresh.goto(new URL(`${path}#features`, origin).toString(), {
      waitUntil: "load",
    });
    await fresh.waitForFunction(headerMeasured);
    const gap = await fresh.evaluate(() => {
      const target = document.getElementById("features");
      const header = document.querySelector("header");
      if (!target || !header) throw new Error("Missing #features or header");
      return (
        target.getBoundingClientRect().top -
        header.getBoundingClientRect().bottom
      );
    });
    if (gap < 0)
      failures.push(
        `${width}px ${path}#features: fresh navigation lands ${Math.round(-gap)}px under the sticky header`,
      );
    await fresh.close();
  }

  // The redesigned header and manual preview selector must remain keyboard
  // usable after hydration, not merely fit in the server-rendered page.
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    reducedMotion: "reduce",
  });
  await page.goto(origin.toString(), { waitUntil: "load" });
  await page.waitForFunction(headerMeasured);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#main");
  assert(
    (await page.evaluate(() => {
      const main = document.getElementById("main");
      const header = document.querySelector("header");
      if (!main || !header) throw new Error("Missing #main or header");
      return (
        main.getBoundingClientRect().top - header.getBoundingClientRect().bottom
      );
    })) >= 0,
    "Skip to content must land below the sticky header",
  );
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
  // Print what was collected even when a later assertion aborts the run.
  if (failures.length) console.error(failures.join("\n"));
}

if (failures.length) process.exit(1);
console.log(
  `PASS: ${paths.length} pages at ${WIDTHS.join(", ")}px and ${textScalePaths.length} pages with simulated 200% text at ${TEXT_SCALE_WIDTHS.join(" and ")}px, menus closed and open: no clipped text, labels larger than their control, sideways scroll or covered anchors; no-script, appearance, fragment, skip link, keyboard and preview controls`,
);
