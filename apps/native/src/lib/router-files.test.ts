import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const conventionRoute = path.resolve(
  __dirname,
  "../../app/(tabs)/(home)/convention/[id]",
);
const conventionDetailSource = readFileSync(`${conventionRoute}.tsx`, "utf8");
const homeLayoutSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/(home)/_layout.tsx"),
  "utf8",
);
const settingsLayoutSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/settings/_layout.tsx"),
  "utf8",
);
const scheduleLayoutSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/schedule/_layout.tsx"),
  "utf8",
);
const scheduleScreenSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/schedule/index.tsx"),
  "utf8",
);
const rootLayoutSource = readFileSync(
  path.resolve(__dirname, "../../app/_layout.tsx"),
  "utf8",
);
const scheduleRefreshHookSource = readFileSync(
  path.resolve(__dirname, "../hooks/useScheduleRefresh.ts"),
  "utf8",
);

describe("Expo Router convention routes", () => {
  it("uses one detail route with its nested import screen", () => {
    expect(existsSync(`${conventionRoute}.tsx`)).toBe(true);
    expect(existsSync(path.join(conventionRoute, "_layout.tsx"))).toBe(false);
    expect(existsSync(path.join(conventionRoute, "import.tsx"))).toBe(true);
  });

  it("presents the event sheet as a nested route without its own layout", () => {
    // The sheet is a pushed formSheet route so the system owns its dismissal
    // (the old RN-Modal version could be unmounted mid-dismiss and strand a
    // touch-eating window). It must stay inside the [id] group with no nested
    // _layout.tsx, or the group would stop sharing the (home) stack.
    expect(
      existsSync(path.join(conventionRoute, "event", "[eventId].tsx")),
    ).toBe(true);
    expect(existsSync(path.join(conventionRoute, "event", "_layout.tsx"))).toBe(
      false,
    );
    expect(homeLayoutSource).toContain(
      'name="convention/[id]/event/[eventId]"',
    );
  });

  // Bouncing is tied to whether there are rows, and both halves matter.
  //
  // Off when empty: a centred "no events" panel that rubber-bands reads as
  // broken. On when populated: the screen sets headerLargeTitleEnabled, and
  // UIKit only lays the large title into the scroll view's content inset when
  // that view can scroll. Hard-coding false put the title on top of the first
  // event row for any schedule short enough to fit on one screen.

  it("keeps convention scroll content connected to the native header", () => {
    expect(conventionDetailSource).toContain("collapsable={false}");
    expect(conventionDetailSource).toContain(
      'contentInsetAdjustmentBehavior="automatic"',
    );
  });

  // @expo/ui's Button disables only natively and still calls onPress, so a
  // second tap on Import that lands before React commits `disabled` ran a
  // whole second import: two conventions holding the same schedule.
  it("builds the import's source snapshot with the shared helper, so earlier identities match", () => {
    const importSource = readFileSync(
      path.join(conventionRoute, "import.tsx"),
      "utf8",
    );

    expect(importSource).toMatch(
      /sourceSnapshot: toSourceSnapshot\(reparsed, preview\.sourceUrl !== null\)/,
    );
    expect(importSource).not.toMatch(
      /activeOccurrences: reparsed\.events\.map/,
    );
  });

  it("lets the Import button start only one import", () => {
    const importSource = readFileSync(
      path.join(conventionRoute, "import.tsx"),
      "utf8",
    );
    const handleImport = importSource.slice(
      importSource.indexOf("async function handleImport"),
      importSource.indexOf("parseIcs(", importSource.indexOf("handleImport")),
    );

    expect(handleImport).toMatch(/runImportOnce\(importLock,/);
    expect(importSource).toMatch(
      /const importBusy = importing \|\| importMutation\.isPending;/,
    );
    expect(importSource).toMatch(
      /onPress=\{handleImport\}\s*disabled=\{\s*importBusy \|\|/,
    );
    expect(importSource).not.toMatch(/disabled=\{importMutation\.isPending\}/);
  });

  // `saving` reaches the Add button only on the next render, so a quick double
  // tap ran handleCreate twice and created two conventions. The edit form's
  // Save already held a ref lock for exactly this (see saveConventionEdit).
  it("lets the Add button create only one convention", () => {
    const createSource = readFileSync(
      path.resolve(conventionRoute, "../create.tsx"),
      "utf8",
    );
    const handleCreate = createSource.slice(
      createSource.indexOf("async function handleCreate"),
      createSource.indexOf("const validTimeZone"),
    );

    expect(createSource).toMatch(/const createLock = useRef\(false\);/);
    // Checked first, and taken before anything awaits.
    expect(handleCreate).toMatch(
      /^async function handleCreate\(\) \{\s*if \(createLock\.current\) return;/,
    );
    const taken = handleCreate.indexOf("createLock.current = true;");
    expect(taken).toBeGreaterThan(0);
    expect(taken).toBeLessThan(handleCreate.indexOf("await "));
    // The form re-enables only through unlock, which frees the lock with it,
    // so a failed attempt can be retried and a landed one cannot repeat.
    expect(handleCreate).toMatch(
      /const unlock = \(\) => \{\s*createLock\.current = false;\s*setSaving\(false\);\s*\};/,
    );
    expect(handleCreate.match(/setSaving\(false\)/g) ?? []).toHaveLength(1);
  });

  // The edit form is a swipeable iOS form sheet, and usePreventRemove is the
  // only thing that stops a swipe. `saving` turns on at the tap, before a
  // geocode of up to ten seconds; guarding on it let the swipe close the sheet
  // with no prompt and dropped the edit just saved. The guard may stand down
  // only once the write itself has started. See saveConventionEdit.
  it("keeps the edit form's discard prompt armed until the write starts", () => {
    const editSource = readFileSync(
      path.join(conventionRoute, "edit.tsx"),
      "utf8",
    );
    const isDirty = editSource.match(
      /useUnsavedChangesGuard\(\{\s*isDirty:([^\n]+)\n/,
    )?.[1];

    expect(isDirty).toBeDefined();
    expect(isDirty).not.toMatch(/\bsaving\b/);
    expect(isDirty).toMatch(/\bwriting\b/);
    expect(editSource).toMatch(/setWriting,/);
  });

  // A Plan day with nothing saved used to drop the whole list header, so the
  // day strip vanished with it even when other days held saved panels.
  it("keeps the Plan header while any panel is saved", () => {
    expect(conventionDetailSource).toMatch(
      /showsScheduleHeader\(\s*view,\s*sections\.length,\s*heroProps !== null,\s*scheduledEvents\.length > 0,?\s*\)/,
    );
  });

  // Unmounting the search bar on an empty Plan or Now view dropped the native
  // field (iOS builds a fresh, empty one on remount) while `searchQuery` kept
  // filtering Browse, so panels looked missing with nothing in the field.
  it("keeps the search field mounted while the convention has events, so its text cannot drift from the query", () => {
    expect(conventionDetailSource).toMatch(
      /\{events\.length > 0 \? \(\s*<Stack\.SearchBar/,
    );
    expect(conventionDetailSource).not.toMatch(
      /sections\.length > 0\) \?\s*\(\s*<Stack\.SearchBar/,
    );
  });

  // The bar is uncontrolled: it has no value prop, so setting `searchQuery`
  // alone left the old text in the native field. A Schedule tab tap reuses
  // this screen, so "dealer" stayed in the field over an unfiltered list and
  // the next keystroke filtered on "dealerx". Only the native Cancel button,
  // which has already emptied the field, may reset the query on its own.
  it("clears the native search field wherever it resets the query", () => {
    expect(conventionDetailSource).toMatch(
      /<Stack\.SearchBar\s+ref=\{searchBarRef\}/,
    );
    const resets = [
      ...conventionDetailSource.matchAll(/setSearchQuery\((?!event\b)[^)]*\)/g),
    ];
    expect(resets.length).toBeGreaterThan(0);
    for (const reset of resets) {
      const before = conventionDetailSource.slice(
        Math.max(0, (reset.index ?? 0) - 60),
        reset.index,
      );
      expect(
        before.includes("searchBarRef.current?.clearText();") ||
          before.includes("onCancelButtonPress={() =>"),
        `${reset[0]} without clearing the field`,
      ).toBe(true);
    }
  });

  // A push to the convention already on top of the Home stack reuses the
  // screen. With the same panel the params came out identical, so the effect
  // never re-ran (and its guard would have stopped it anyway): a second tap on
  // the same panel left the user wherever they had scrolled, with no pulse.
  it("handles each highlight request once, keyed on when it was made", () => {
    expect(conventionDetailSource).toMatch(/highlightAt\?: string;/);
    expect(conventionDetailSource).toMatch(
      /const highlightRequest = highlightEventId\s*\?\s*`\$\{highlightEventId\}:\$\{highlightAt \?\? ""\}`\s*:\s*null;/,
    );
    expect(conventionDetailSource).toContain(
      "scrolledToHighlight.current === highlightRequest",
    );
    expect(conventionDetailSource).toContain(
      "scrolledToHighlight.current = highlightRequest;",
    );
    expect(conventionDetailSource).not.toContain(
      "scrolledToHighlight.current === highlightEventId",
    );
  });

  it("makes every reminder tap a new highlight request", () => {
    expect(rootLayoutSource).toMatch(
      /\{\s*id: conventionId,\s*highlightEventId: eventId,\s*highlightAt: String\(Date\.now\(\)\),?\s*\}/,
    );
  });

  // Catalog conventions have no icalUrl but the refresh checks them through
  // their catalogSlug. Gating the menu on icalUrl alone left them without a
  // pressed check, and so without the failure banner and its Retry. Gating it
  // on a source alone went too far the other way: an ended or archived
  // convention, or one imported with categories left out, showed the item and
  // the refresh skipped every press, so it answered with nothing at all.
  it("offers Check for Changes exactly where the refresh can check", () => {
    expect(conventionDetailSource).toMatch(
      /\{scheduleRefresh\.canCheck \? \(\s*<Stack\.Toolbar\.MenuAction\s+icon=\{[^}]*\}\s*onPress=\{scheduleRefresh\.checkNow\}/,
    );
    expect(conventionDetailSource).not.toContain(
      "{hasScheduleSource(convention) ? (",
    );
    expect(conventionDetailSource).not.toContain("{convention?.icalUrl ? (");
    expect(scheduleRefreshHookSource).toContain("canCheckSchedule(convention)");
  });
});

describe("Routes that track whether they are still open", () => {
  // Fast Refresh keeps a component's refs but runs its `[]` effects' cleanup
  // and then the effects again. A mount effect that only clears the flag
  // leaves it false after a hot reload, and every write behind an
  // `isMounted` check silently does nothing -- Import stuck on "Importing..."
  // -- until a full reload. Found by pattern, so a route added later is
  // covered the day it is added.
  const appRoot = path.resolve(__dirname, "../../app");
  const routes = (readdirSync(appRoot, { recursive: true }) as string[])
    .filter((file) => file.endsWith(".tsx"))
    .map(
      (file) => [file, readFileSync(path.join(appRoot, file), "utf8")] as const,
    )
    .filter(([, source]) => /const isMounted = useRef\(/.test(source));

  it("finds the routes to check", () => {
    expect(routes.map(([file]) => path.basename(file))).toEqual(
      expect.arrayContaining(["edit.tsx", "import.tsx"]),
    );
  });

  it.each(routes)(
    "%s sets isMounted again each time it mounts",
    (_file, source) => {
      expect(source).toMatch(
        /useEffect\(\(\) => \{\s*isMounted\.current = true;/,
      );
    },
  );
});

describe("iOS native stack headers", () => {
  it("uses native large titles without a competing fixed blur", () => {
    for (const source of [
      homeLayoutSource,
      settingsLayoutSource,
      scheduleLayoutSource,
    ]) {
      expect(source).toContain(
        'headerLargeTitleEnabled: process.env.EXPO_OS === "ios"',
      );
      expect(source).not.toContain("headerBlurEffect");
      // A transparent bar is what this guards against, not the word. The
      // settings layout now states `headerTransparent: false` for its
      // `@expo/ui` screens, which is the opposite of the mistake -- UIKit
      // leaves those bars transparent on its own because nothing links them to
      // a scroll view.
      expect(source).not.toContain("headerTransparent: true");
    }
  });

  // The settings family is the one shape the guard above cannot speak for.
  //
  // UIKit wires a bar's large-title collapse and its scroll-edge background to a
  // scroll view it can see. A SwiftUI `List` inside an `@expo/ui` `Host` is not
  // that view, so those bars stay in their scrolled-to-top appearance forever:
  // transparent, never collapsing. Content then slid underneath and drew through
  // the title -- the app icon crossed the words "About ConPaws", and the
  // notification row crossed "Settings".
  //
  // `hostedScreenOptions` is the fix, and a new screen in this stack gets the
  // bug simply by not spreading it. Asserting the pattern rather than a list of
  // names so a screen added later is covered on the day it is added.
  describe("settings screens hosted in @expo/ui", () => {
    // Real `ScrollView` content: these collapse and blur correctly on their own,
    // and forcing the hosted options on them would be the regression.
    const REAL_SCROLLVIEW_SCREENS = ["licenses/index", "licenses/[id]"];
    // Dev-only, behind `Stack.Protected`; they never reach a user.
    const DEVELOPER_SCREENS = ["debug", "ui-system"];
    // Hosted screens that hand UIKit their list's scroll view through
    // ContentScrollLink, so they keep the tab's large title and it collapses.
    const LINKED_SCREENS = ["index"];

    const screens = settingsLayoutSource
      .split("<Stack.Screen")
      .slice(1)
      .map((block) => ({
        name: block.match(/name="([^"]+)"/)?.[1],
        block,
      }))
      .filter(
        (screen): screen is { name: string; block: string } =>
          screen.name !== undefined,
      );

    it("finds the screens to check", () => {
      expect(screens.length).toBeGreaterThan(5);
    });

    it.each(
      screens
        .filter(
          ({ name }) =>
            !REAL_SCROLLVIEW_SCREENS.includes(name) &&
            !DEVELOPER_SCREENS.includes(name) &&
            !LINKED_SCREENS.includes(name),
        )
        .map(({ name, block }) => [name, block] as const),
    )('"%s" spreads hostedScreenOptions', (_name, block) => {
      expect(block).toContain("...hostedScreenOptions");
    });

    it.each(LINKED_SCREENS)(
      '"%s" keeps its large title and links its list to the bar',
      (name) => {
        const screen = screens.find((candidate) => candidate.name === name);
        expect(screen).toBeDefined();
        expect(screen?.block).not.toContain("...hostedScreenOptions");
        // Without the link the bar is the transparent, never-collapsing one
        // this guard exists for, so the route must wrap its Host in it.
        const routeSource = readFileSync(
          path.resolve(__dirname, `../../app/(tabs)/settings/${name}.tsx`),
          "utf8",
        );
        expect(routeSource).toMatch(
          /<ContentScrollLink[^>]*>\s*<Host[\s\S]*<\/Host>\s*<\/ContentScrollLink>/,
        );
      },
    );

    it("leaves the real-ScrollView screens their large titles", () => {
      for (const name of REAL_SCROLLVIEW_SCREENS) {
        const screen = screens.find((candidate) => candidate.name === name);
        expect(screen).toBeDefined();
        expect(screen?.block).not.toContain("...hostedScreenOptions");
      }
    });

    it("keeps hostedScreenOptions doing all three things", () => {
      // Spreading an emptied-out constant would pass every assertion above while
      // shipping the bug again.
      expect(settingsLayoutSource).toContain("headerLargeTitleEnabled: false");
      expect(settingsLayoutSource).toContain("headerTransparent: false");
      expect(settingsLayoutSource).toMatch(
        /headerStyle:\s*\{\s*backgroundColor:/,
      );
    });
  });

  it("keeps every form sheet compact", () => {
    // Counting occurrences would just need bumping each time a sheet is added,
    // and would pass if a new sheet were added while an old one lost the flag.
    // Assert the invariant instead: a form sheet never gets a large title.
    const sheets = homeLayoutSource
      .match(/options=\{\{[\s\S]*?\}\}/g)
      ?.filter((block) => block.includes("presentation: FORM_PRESENTATION"));

    expect(sheets?.length).toBeGreaterThan(0);
    for (const sheet of sheets ?? []) {
      expect(sheet).toContain("headerLargeTitleEnabled: false");
    }
  });

  it("presents forms as a sheet on iOS and a full-screen modal on Android", () => {
    // Android clipped the form's own header row away when the sheet re-laid-out
    // for the keyboard, so it gets a full-screen modal instead. Android also
    // renders its header in-content, because Stack.Toolbar never reaches
    // headerLeft/headerRight there -- so the native header must stay hidden or
    // the screen shows two titles.
    // The rule lives beside the form header so the edit and import screens
    // can tell whether the window or the sheet sets their width.
    const formSharedSource = readFileSync(
      path.resolve(__dirname, "../components/FormModalHeader.shared.ts"),
      "utf8",
    );
    expect(formSharedSource).toContain(
      'export const FORM_PRESENTED_AS_SHEET = process.env.EXPO_OS === "ios"',
    );
    expect(homeLayoutSource).toContain(
      'FORM_PRESENTED_AS_SHEET ? "formSheet" : "modal"',
    );
    expect(homeLayoutSource).toContain(
      'const FORM_HEADER_SHOWN = process.env.EXPO_OS === "ios"',
    );
  });
});

describe("Schedule tab", () => {
  // Same failure the convention schedule hit: with bouncing hard-coded off,
  // a list short enough to fit gives the iOS large title no content inset to
  // occupy, so it paints over the first row.

  it("keeps scroll content connected to the native header", () => {
    expect(scheduleScreenSource).toContain("collapsable={false}");
    expect(scheduleScreenSource).toContain(
      'contentInsetAdjustmentBehavior="automatic"',
    );
  });

  // A bare push opened the convention on whatever day Browse was last on, so
  // the tapped panel was usually off screen. The highlight resets the filters
  // to the panel's day, scrolls to it and pulses the row.
  it("opens a Schedule tab row on its own panel", () => {
    expect(scheduleScreenSource).toMatch(
      /pathname: "\/convention\/\[id\]",\s*params: \{\s*id: entry\.conventionId,\s*highlightEventId: event\.id/,
    );
    expect(scheduleScreenSource).not.toMatch(
      /router\.push\(`\/convention\/\$\{entry\.conventionId\}`\)/,
    );
  });

  // Tapping the same panel twice gave the reused convention screen identical
  // params, so the second tap only switched tabs. See the convention test
  // "handles each highlight request once".
  it("makes every Schedule tab tap a new highlight request", () => {
    expect(scheduleScreenSource).toMatch(
      /params: \{\s*id: entry\.conventionId,\s*highlightEventId: event\.id,\s*highlightAt: String\(Date\.now\(\)\),?\s*\}/,
    );
  });
});

describe("Both schedules mark clashing events", () => {
  // The Schedule tab computed its overlap grouping and then never passed
  // `hasConflict`, so `EventItem` fell back to its `false` default and the
  // "Overlaps" label could not render there at all. The cluster header still
  // did, which is why it looked like a styling quirk rather than a missing
  // prop: the two say different things. The header says these rows share a
  // time band; the label says this event genuinely clashes.
  it.each([
    ["schedule tab", scheduleScreenSource],
    ["convention detail", conventionDetailSource],
  ])("%s passes hasConflict to its rows", (_name, source) => {
    expect(source).toContain("hasConflict={");
  });

  // Both screens must decide a clash the same way. `overlapInfo` gives an
  // event with no end time a fallback duration so it can still be grouped;
  // `overlappingEventIds` skips it. Deriving the label from the grouping count
  // instead would make one screen claim clashes the other does not, for the
  // same two events.
  it.each([
    ["schedule tab", scheduleScreenSource],
    ["convention detail", conventionDetailSource],
  ])("%s decides a clash with overlappingEventIds", (_name, source) => {
    expect(source).toContain("overlappingEventIds");
  });
});

describe("Windowed lists redraw when their formatting inputs change", () => {
  // Both schedules format their rows -- and the schedule tab its day headers --
  // from values that live outside the section data: the locale, the clock
  // preference, and on the convention screen the highlighted event. A
  // VirtualizedList reuses cached cells whenever the data identity is
  // unchanged, so without `extraData` those cells keep whatever they were first
  // rendered with. That shipped as English chrome sitting above Russian day
  // headers after a language change, until the next cold start.
  //
  // Asserting the prop is present rather than its exact contents: the set of
  // inputs will grow, and a test that pins the string would only ever be
  // updated to match whatever the code already says.
  it.each([
    ["schedule tab", scheduleScreenSource],
    ["convention detail", conventionDetailSource],
  ])("%s passes extraData to its SectionList", (_name, source) => {
    expect(source).toContain("extraData={");
  });

  it("keys the schedule tab's extraData on the locale and clock", () => {
    expect(scheduleScreenSource).toMatch(/extraData=\{`[^`]*\$\{locale\}/);
    expect(scheduleScreenSource).toMatch(/extraData=\{`[^`]*\$\{hour12\}/);
  });

  // The font scale is the non-obvious one. iOS delivers a Dynamic Type change
  // to a running app, and the cells that are already measured keep their old
  // heights, so the larger text is drawn clipped through the middle of the
  // glyphs. A cold start at the same text size is fine, which is exactly why
  // this is easy to reintroduce.
  it.each([
    ["schedule tab", scheduleScreenSource],
    ["convention detail", conventionDetailSource],
  ])("%s rebuilds its cells when the font scale changes", (_name, source) => {
    expect(source).toContain("useWindowDimensions");
    expect(source).toMatch(/extraData=\{`[^`]*\$\{fontScale\}/);
  });
});

describe("Expo Router stack headers", () => {
  it("titles every screen whose native header is shown", () => {
    // Without a title, iOS shows the route path ("convention/[id]/event/…")
    // in the header. A screen may instead set its title at runtime.
    const appRoot = path.resolve(__dirname, "../../app");
    const layouts = (readdirSync(appRoot, { recursive: true }) as string[])
      .filter((file) => path.basename(file) === "_layout.tsx")
      .map((file) => path.join(appRoot, file));
    const untitled: string[] = [];
    for (const layout of layouts) {
      const source = readFileSync(layout, "utf8");
      for (const [, name, options] of source.matchAll(
        /<Stack\.Screen\s+name="([^"]+)"([\s\S]*?)\/>/g,
      )) {
        if (/headerShown:\s*false|title:/.test(options)) continue;
        const route = path.join(path.dirname(layout), `${name}.tsx`);
        const runtime = existsSync(route) ? readFileSync(route, "utf8") : "";
        if (/<Stack\.Screen[\s\S]*?title:/.test(runtime)) continue;
        untitled.push(path.relative(appRoot, route));
      }
    }
    expect(layouts.length).toBeGreaterThan(1);
    expect(untitled).toEqual([]);
  });
});
