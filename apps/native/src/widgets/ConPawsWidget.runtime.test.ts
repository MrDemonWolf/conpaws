import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import type { File } from "@babel/types";
import type { ExpoWidgetsConfigPluginProps } from "expo-widgets/plugin/build/withWidgets";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { WidgetSnapshot } from "@/services/widget-snapshot";
import { buildStoredWidgetTimeline } from "@/services/widget-timeline";
import createAppConfig from "../../app.config";
import type {
  ConPawsWidgetConfiguration,
  ConPawsWidgetProps,
  WidgetStrings,
} from "./ConPawsWidget.types";

const require = createRequire(import.meta.url);
const babel: {
  transformSync(
    source: string,
    options: Record<string, unknown>,
  ): {
    ast?: File;
  } | null;
} = require("@babel/core");
const NOW = Date.parse("2026-11-16T12:00:00Z");
const platforms = ["ios", "android"] as const;
const layouts = new Map<string, string>();
let iosComponents: string[] = [];
let iosModifiers: string[] = [];
let androidComponents: string[] = [];
let androidModifiers: string[] = [];
const ACCENTS = ["#00618A", "#18B7F2"];
const FAMILIES = [
  "systemSmall",
  "systemMedium",
  "systemLarge",
  "accessoryCircular",
  "accessoryRectangular",
  "accessoryInline",
] as const;
const SYSTEM_FAMILIES = ["systemSmall", "systemMedium", "systemLarge"] as const;
const uiRoot = path.dirname(require.resolve("@expo/ui/package.json"));
const widgetsRoot = path.dirname(require.resolve("expo-widgets/package.json"));
const nativeRoot = path.resolve(import.meta.dirname, "../..");
const widgetPlugin = createAppConfig({
  projectRoot: nativeRoot,
  staticConfigPath: null,
  packageJsonPath: path.join(nativeRoot, "package.json"),
  config: {},
}).plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-widgets",
);
if (!Array.isArray(widgetPlugin))
  throw new Error("Missing Expo Widgets config");
const parameters = (
  widgetPlugin[1] as ExpoWidgetsConfigPluginProps
).widgets?.find((widget) => widget.name === "ConPawsWidget")?.ios?.configuration
  ?.parameters;
const conventionDefault = parameters?.convention?.default;
const modeDefault = parameters?.mode?.default;
if (
  typeof conventionDefault !== "string" ||
  (modeDefault !== "automatic" &&
    modeDefault !== "countdown" &&
    modeDefault !== "nextEvent")
)
  throw new Error("Unexpected ConPaws widget configuration defaults");
const defaultConfiguration: ConPawsWidgetConfiguration = {
  convention: conventionDefault,
  mode: modeDefault,
};

beforeAll(async () => {
  for (const platform of platforms) {
    const filename = path.join(
      import.meta.dirname,
      `ConPawsWidget.${platform}.tsx`,
    );
    const result = babel.transformSync(readFileSync(filename, "utf8"), {
      filename,
      configFile: false,
      babelrc: false,
      ast: true,
      plugins: [
        [
          require.resolve("@babel/plugin-transform-typescript"),
          { isTSX: true },
        ],
        [
          require.resolve("@babel/plugin-transform-react-jsx"),
          { runtime: "automatic" },
        ],
        require("babel-preset-expo/build/plugins/widgets-plugin").widgetsPlugin,
      ],
    });
    const declaration = result?.ast?.program.body.find(
      (node) =>
        node.type === "ExportNamedDeclaration" &&
        node.declaration?.type === "VariableDeclaration" &&
        node.declaration.declarations.some(
          (item) =>
            item.id.type === "Identifier" &&
            item.id.name === "ConPawsWidgetLayout",
        ),
    );
    if (
      declaration?.type !== "ExportNamedDeclaration" ||
      declaration.declaration?.type !== "VariableDeclaration"
    )
      throw new Error("Widget directive was not serialized");
    const layout = declaration.declaration.declarations[0].init;
    if (layout?.type !== "TemplateLiteral")
      throw new Error("Expected isolated widget source");
    layouts.set(platform, layout.quasis[0].value.cooked ?? "");
    // The stand-ins are exactly what each file imports, so a name the
    // isolated runtime would not have throws in the VM instead of silently
    // drawing nothing on device.
    for (const node of result?.ast?.program.body ?? []) {
      if (node.type !== "ImportDeclaration") continue;
      const names = node.specifiers.map((item) => item.local.name);
      if (node.source.value === "@expo/ui/swift-ui") iosComponents = names;
      if (node.source.value === "@expo/ui/swift-ui/modifiers")
        iosModifiers = names;
      if (node.source.value === "@expo/ui/jetpack-compose")
        androidComponents = names;
      if (node.source.value === "@expo/ui/jetpack-compose/modifiers")
        androidModifiers = names;
    }
  }
}, 30_000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function snapshot(): WidgetSnapshot {
  return {
    schemaVersion: 2,
    generatedAtMs: NOW,
    localeIdentifier: "en",
    timeFormat: "24",
    conventions: [
      {
        id: "con",
        name: "Sample Con",
        startAtMs: NOW - 86_400_000,
        endAtMs: NOW + 86_400_000,
        timeZoneIdentifier: "UTC",
        dateRangeLabel: "Nov 15–17",
        events: [
          {
            id: "panel",
            title: "Opening",
            startAtMs: NOW + 600_000,
            endAtMs: NOW + 3_600_000,
            location: "Venue",
            room: "Room",
            reminderMinutes: 15,
            ageRating: null,
          },
        ],
      },
    ],
  };
}

function render(
  platform: string,
  props: ConPawsWidgetProps,
  family = "systemSmall",
  configuration: ConPawsWidgetConfiguration = defaultConfiguration,
  environment: Record<string, unknown> = {},
) {
  // This checks the actual Expo Babel serialization in an isolated VM. Native
  // components/modifiers are deliberately bounded test doubles; Metro exports
  // and native target builds separately verify the real framework integration.
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const component = (name: string) => (props: Record<string, unknown>) => ({
    type: name,
    props: name === "TextView" ? { ...props, text: props.children } : props,
  });
  const globals: Record<string, unknown> = {
    Date,
    Intl,
    console,
    _jsx: jsx,
    _jsxs: jsx,
    _Fragment: "Fragment",
  };
  const modifier =
    (name: string) =>
    (...values: unknown[]) => ({ type: name, values });
  if (platform === "ios") {
    for (const name of iosComponents) globals[name] = component(name);
    globals.Text = component("TextView");
    for (const name of iosModifiers) globals[name] = modifier(name);
    // `shapes` is a builder object, not a modifier; the shape names are
    // checked against Expo UI in the import test below.
    if (iosModifiers.includes("shapes"))
      globals.shapes = new Proxy(
        {},
        {
          get: (_target, shape: string) => (params?: object) => ({
            ...params,
            shape,
          }),
        },
      );
  } else {
    for (const name of androidComponents) globals[name] = component(name);
    globals.Text = component("TextView");
    for (const name of androidModifiers) globals[name] = modifier(name);
  }
  globals.__props = props;
  globals.__environment = {
    date: new Date(NOW),
    widgetFamily: family,
    configuration,
    colorScheme: "light",
    widgetRenderingMode: "fullColor",
    ...environment,
  };
  const context = vm.createContext(globals);
  const tree = vm.runInContext(
    `(${layouts.get(platform)})(__props, __environment)`,
    context,
    { timeout: 5_000 },
  );
  function normalize(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(normalize);
    if (!node || typeof node !== "object" || node instanceof Date) return node;
    const value = node as { type?: unknown; props?: Record<string, unknown> };
    if (typeof value.type === "function")
      return normalize(value.type(value.props));
    return Object.fromEntries(
      Object.entries(node).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return normalize(tree);
}

interface Node {
  type: string;
  props: Record<string, unknown> & {
    text?: unknown;
    title?: unknown;
    modifiers?: { type: string; values: unknown[] }[];
  };
}

function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || tree instanceof Date) return [];
  const value = tree as Partial<Node>;
  const own =
    typeof value.type === "string" && value.props ? [value as Node] : [];
  return own.concat(Object.values(tree).flatMap(nodes));
}

/** Visible text: Text nodes and Label titles. */
function texts(node: unknown): string[] {
  return nodes(node).flatMap((item) =>
    item.type === "TextView" && typeof item.props.text === "string"
      ? [item.props.text]
      : item.type === "Label" && typeof item.props.title === "string"
        ? [item.props.title]
        : [],
  );
}

/** Modifiers Expo UI applies on the Image itself rather than registering. */
function imageModifierNames(registry: string): string[] {
  const start = registry.indexOf("func applyImageModifier(");
  if (start < 0) return [];
  const body = registry.slice(start, registry.indexOf("default:", start));
  return [...body.matchAll(/case "(\w+)":/g)].map(([, name]) => name);
}

function modifierValue(node: Node, type: string): unknown {
  return node.props.modifiers?.find((item) => item.type === type)?.values[0];
}

/** Every string the layout could show or speak. */
function strings(tree: unknown): string[] {
  const out: string[] = [];
  (function walk(value: unknown) {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object" && !(value instanceof Date))
      Object.values(value).forEach(walk);
  })(tree);
  return out;
}

function spokenLabel(tree: unknown): string {
  return String(
    (tree as Node).props.modifiers?.find(
      (item) => item.type === "accessibilityLabel",
    )?.values[0],
  );
}

/** Text nodes painted with a hard-coded brand accent. */
function accentTexts(tree: unknown): string[] {
  return nodes(tree)
    .filter(
      (node) =>
        node.type === "TextView" &&
        node.props.modifiers?.some(
          (item) =>
            item.type === "foregroundStyle" &&
            ACCENTS.includes(item.values[0] as string),
        ),
    )
    .map((node) => String(node.props.text));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function event(
  id: string,
  startOffset: number,
  overrides: Partial<
    WidgetSnapshot["conventions"][number]["events"][number]
  > = {},
) {
  return {
    id,
    title: `Panel ${id}`,
    startAtMs: NOW + startOffset,
    endAtMs: NOW + startOffset + HOUR,
    location: "Venue",
    room: `Room ${id}`,
    reminderMinutes: null,
    ageRating: null,
    ...overrides,
  };
}

/** One snapshot per state the widget can be in, all at NOW. */
function states(): Record<string, ConPawsWidgetProps> {
  const make = (
    events: ReturnType<typeof event>[],
    patch: Partial<WidgetSnapshot["conventions"][number]> = {},
  ): ConPawsWidgetProps => {
    const data = snapshot();
    Object.assign(data.conventions[0], { events, ...patch });
    return { snapshot: data };
  };
  const empty = snapshot();
  empty.conventions = [];
  const stale = make([event("a", 20 * MINUTE)]);
  stale.snapshot.generatedAtMs = NOW - 2 * HOUR;
  return {
    countdownDays: make([event("a", 6 * 86_400_000)], {
      startAtMs: NOW + 5 * 86_400_000,
    }),
    countdownTomorrow: make([], { startAtMs: NOW + 86_400_000 }),
    countdownHours: make([], { startAtMs: NOW + 3 * HOUR }),
    reminder: make([
      event("a", 10 * MINUTE, { reminderMinutes: 15 }),
      event("b", 2 * HOUR),
    ]),
    next: make([event("a", 20 * MINUTE), event("b", 2 * HOUR)]),
    now: make([
      event("a", -10 * MINUTE),
      event("b", 2 * HOUR),
      event("c", 3 * HOUR),
    ]),
    open: make([event("a", -10 * MINUTE, { endAtMs: null })]),
    finished: make([event("a", -2 * HOUR)]),
    noPicks: make([]),
    empty: { snapshot: empty },
    stale,
    expired: { snapshot: snapshot(), expired: true },
    invalid: {
      snapshot: {
        ...snapshot(),
        schemaVersion: 99,
      } as unknown as WidgetSnapshot,
    },
  };
}

describe("isolated Expo widget renderers", () => {
  it.each([
    "systemSmall",
    "systemMedium",
    "systemLarge",
    "accessoryCircular",
    "accessoryRectangular",
    "accessoryInline",
  ])(
    "renders the stored iOS timeline, which has no null fields: %s",
    (family) => {
      const source = snapshot();
      // Under way, no end and no reminder: every field iOS cannot store is gone.
      source.conventions[0].events = [
        {
          id: "open",
          title: "Open Lounge",
          startAtMs: NOW - 600_000,
          endAtMs: null,
          location: null,
          room: null,
          reminderMinutes: null,
          ageRating: null,
        },
        {
          id: "next",
          title: "Closing",
          startAtMs: NOW + 1_800_000,
          endAtMs: null,
          location: null,
          room: null,
          reminderMinutes: null,
          ageRating: null,
        },
      ];
      const [entry] = buildStoredWidgetTimeline(source);
      expect(entry.props.snapshot.conventions[0].events[0]).not.toHaveProperty(
        "endAtMs",
      );
      const visible = texts(render("ios", entry.props, family)).join(" ");
      expect(visible).not.toMatch(/Invalid|NaN|undefined|null/);
      // The circular family only has room for the next start time.
      expect(visible).toMatch(
        family === "accessoryCircular"
          ? /12:30/
          : /Open Lounge|Closing|Sample Con/,
      );
    },
  );

  it("uses the app-config Automatic choice and an unset native selection", () => {
    for (const convention of [
      defaultConfiguration.convention,
      null,
      undefined,
    ]) {
      const visible = texts(
        render("ios", { snapshot: snapshot() }, "systemSmall", {
          ...defaultConfiguration,
          convention,
        }),
      ).join(" ");
      expect(visible).toContain("Opening");
    }
  });

  it.each([
    "systemSmall",
    "systemMedium",
    "systemLarge",
    "accessoryCircular",
    "accessoryRectangular",
    "accessoryInline",
  ])("renders iOS %s without app-runtime captures", (family) => {
    expect(
      texts(render("ios", { snapshot: snapshot() }, family)).join(" "),
    ).not.toBe("");
    const initialTree = render(
      "ios",
      {
        snapshot: {
          schemaVersion: 2,
          generatedAtMs: 0,
          localeIdentifier: "en",
          conventions: [],
        },
      },
      family,
    );
    expect(JSON.stringify(initialTree)).not.toContain("widgetURL");
    expect(JSON.stringify(initialTree)).not.toContain("conpaws://");
  });

  it.each(platforms)(
    "renders empty, current and finished states on %s",
    (platform) => {
      const data = snapshot();
      data.conventions = [];
      expect(
        texts(render(platform, { snapshot: data })).join(" "),
      ).not.toContain("Opening");
      data.conventions = snapshot().conventions;
      data.conventions[0].events[0].startAtMs = NOW - 600_000;
      expect(texts(render(platform, { snapshot: data })).join(" ")).toContain(
        "Opening",
      );
      data.conventions[0].events[0].endAtMs = NOW - 1;
      expect(
        texts(render(platform, { snapshot: data })).join(" "),
      ).not.toContain("Opening");
    },
  );

  it.each(["empty", "finished"] as const)(
    "Android keeps a future saved pick visible after an earlier %s convention",
    (earlierState) => {
      const data = snapshot();
      const base = data.conventions[0];
      const panel = base.events[0];
      data.conventions = [
        {
          ...base,
          id: "earlier",
          name: "Earlier Con",
          startAtMs:
            NOW + (earlierState === "empty" ? 86_400_000 : -86_400_000),
          endAtMs: NOW + 2 * 86_400_000,
          events:
            earlierState === "empty"
              ? []
              : [
                  {
                    ...panel,
                    title: "Finished panel",
                    startAtMs: NOW - 3_600_000,
                    endAtMs: NOW - 1,
                  },
                ],
        },
        {
          ...base,
          id: "future-picked",
          name: "Future Con",
          startAtMs: NOW + 3 * 86_400_000,
          endAtMs: NOW + 4 * 86_400_000,
          events: [
            {
              ...panel,
              title: "Future panel",
              startAtMs: NOW + 3 * 86_400_000 + 3_600_000,
              endAtMs: NOW + 3 * 86_400_000 + 7_200_000,
            },
          ],
        },
      ];
      const visible = texts(render("android", { snapshot: data })).join(" ");
      expect(visible).toContain("Future panel");
      expect(visible).toContain("Future Con");
      expect(visible).not.toContain("Earlier Con");
      expect(visible).not.toContain("Finished panel");
    },
  );

  it("keeps an ongoing final event and does not invent its missing end", () => {
    const data = snapshot();
    Object.assign(data.conventions[0].events[0], {
      startAtMs: NOW - 600_000,
      endAtMs: null,
    });
    const visible = texts(render("ios", { snapshot: data })).join(" ");
    expect(visible).toContain("Opening");
    expect(visible).toContain("11:50");
    expect(visible).not.toContain("UNTIL");
  });

  it("honors per-instance convention and Next Event mode", () => {
    const data = snapshot();
    data.conventions[0].startAtMs = NOW + 86_400_000;
    expect(texts(render("ios", { snapshot: data })).join(" ")).toContain(
      "Tomorrow",
    );
    expect(
      texts(
        render("ios", { snapshot: data }, "systemSmall", {
          convention: "con",
          mode: "nextEvent",
        }),
      ).join(" "),
    ).toContain("Opening");
  });

  it("pins a different convention and uses the convention time zone", () => {
    const data = snapshot();
    data.conventions.push({
      ...data.conventions[0],
      id: "other",
      name: "Other Con",
      timeZoneIdentifier: "America/Chicago",
      events: [{ ...data.conventions[0].events[0], title: "Pinned panel" }],
    });
    const visible = texts(
      render("ios", { snapshot: data }, "systemSmall", {
        convention: "other",
        mode: "nextEvent",
      }),
    ).join(" ");
    expect(visible).toContain("Pinned panel");
    expect(visible).toContain("06:10");
    expect(visible).not.toContain("Opening");
    const missing = texts(
      render("ios", { snapshot: data }, "systemSmall", {
        convention: "removed",
        mode: "automatic",
      }),
    ).join(" ");
    expect(missing).toContain("No convention yet");
    expect(missing).not.toContain("Opening");
    expect(missing).not.toContain("Pinned panel");
  });

  it("shows a time, not a title initial, in the circular family", () => {
    const data = snapshot();
    data.conventions[0].events[0].reminderMinutes = null;
    data.conventions[0].events[0].title = "🐺 Opening";
    const next = render("ios", { snapshot: data }, "accessoryCircular");
    expect(texts(next)).toContain("12:10");
    expect(texts(next)).not.toContain("🐺");
    expect(texts(next).join(" ")).not.toContain("HAPPENING NOW");
    expect(spokenLabel(next)).toContain("Next event: 🐺 Opening");
    // In the reminder window the ring counts the minutes left.
    data.conventions[0].events[0].reminderMinutes = 15;
    const reminder = render("ios", { snapshot: data }, "accessoryCircular");
    expect(reminder).toMatchObject({ type: "Gauge" });
    expect(texts(reminder)).toContain("10");
    // A panel under way fills the ring and names its real end.
    Object.assign(data.conventions[0].events[0], {
      startAtMs: NOW - 15 * MINUTE,
      endAtMs: NOW + 45 * MINUTE,
    });
    const running = render("ios", { snapshot: data }, "accessoryCircular");
    expect(running).toMatchObject({ type: "Gauge", props: { value: 0.25 } });
    expect(texts(running)).toContain("12:45");
  });

  it.each(platforms)(
    "rejects an unsupported snapshot schema on %s",
    (platform) => {
      const data = {
        ...snapshot(),
        schemaVersion: 99,
      } as unknown as WidgetSnapshot;
      const visible = texts(render(platform, { snapshot: data })).join(" ");
      expect(visible).not.toContain("Opening");
      expect(visible).not.toBe("");
    },
  );

  it("uses canonical app-language labels and explicit clock preferences", () => {
    const data = snapshot();
    // Outside the reminder window, so the eyebrow is the plain "up next".
    data.conventions[0].events[0].reminderMinutes = 5;
    data.localeIdentifier = "de";
    data.timeFormat = "12";
    data.presentation = {
      appearance: "system",
      appScheme: "conpaws-dev",
      palette: {
        light: {
          background: "#FFFFFF",
          foreground: "#000000",
          secondary: "#333333",
          accent: "#005575",
        },
        dark: {
          background: "#000000",
          foreground: "#FFFFFF",
          secondary: "#CCCCCC",
          accent: "#18B7F2",
        },
      },
      labels: {
        next: "Next",
        current: "Current",
        noEvents: "None",
        finished: "Finished",
      },
      strings: { language: "de", upNextCaps: "ALS NÄCHSTES" } as WidgetStrings,
    };
    const tree = render("ios", { snapshot: data });
    const visible = texts(tree).join(" ");
    expect(visible).toContain("ALS NÄCHSTES");
    expect(visible).toMatch(/12:10/);
    expect(JSON.stringify(tree)).toContain("conpaws-dev://convention/con");
    expect(JSON.stringify(tree)).not.toContain("conpaws://");
    expect(JSON.stringify(tree)).toContain("Next event: Opening, starts");
    expect(JSON.stringify(tree)).not.toContain("%1$@");
  });

  it("shows a refresh state for the expired iOS timeline", () => {
    const visible = texts(
      render("ios", { snapshot: snapshot(), expired: true }),
    ).join(" ");
    expect(visible).not.toContain("Opening");
    expect(visible).toContain("Open ConPaws to update your plan.");
  });
});

describe("iOS widget design rules", () => {
  it("only uses components and modifiers the installed Expo widget runtime renders", () => {
    expect(iosComponents.length).toBeGreaterThan(0);
    expect(iosModifiers.length).toBeGreaterThan(0);
    const renderer = readFileSync(
      path.join(widgetsRoot, "ios/Widgets/ViewRenderer.swift"),
      "utf8",
    );
    for (const name of iosComponents) {
      const built = readFileSync(
        path.join(uiRoot, "build/swift-ui", name, "index.js"),
        "utf8",
      );
      const nativeType = built.match(
        /requireNativeView\('ExpoUI', '(\w+)'\)/,
      )?.[1];
      expect(nativeType, name).toBeTruthy();
      // A view type the widget renderer does not list draws nothing in release.
      expect(renderer, name).toContain(`case "${nativeType}":`);
    }
    const modifierDir = path.join(uiRoot, "build/swift-ui/modifiers");
    const declarations = [
      ...readdirSync(modifierDir).filter((file) => file.endsWith(".d.ts")),
      "shapes/index.d.ts",
    ]
      .map((file) => readFileSync(path.join(modifierDir, file), "utf8"))
      .join("\n");
    // Expo UI registers its own modifiers; expo-widgets adds the widget ones.
    const registries = [
      readFileSync(
        path.join(uiRoot, "ios/Modifiers/ViewModifierRegistry.swift"),
        "utf8",
      ),
      readFileSync(
        path.join(widgetsRoot, "ios/Widgets/WidgetModifiers.swift"),
        "utf8",
      ),
    ].join("\n");
    const imageOnly = imageModifierNames(registries);
    for (const name of iosModifiers) {
      expect(declarations, name).toMatch(
        new RegExp(`export declare (const|function) ${name}\\b`),
      );
      if (name === "shapes" || imageOnly.includes(name)) continue;
      expect(registries, name).toContain(`register("${name}")`);
    }
    // Shape builders the layout calls must exist in the installed builder.
    const shapeSource = readFileSync(
      path.join(modifierDir, "shapes/index.d.ts"),
      "utf8",
    );
    const used = readFileSync(
      path.join(import.meta.dirname, "ConPawsWidget.ios.tsx"),
      "utf8",
    ).matchAll(/shapes\.(\w+)\(/g);
    for (const [, shape] of used) expect(shapeSource, shape).toContain(shape);
  });

  it("fails on a component or modifier the file did not import", () => {
    const layout = layouts.get("ios") ?? "";
    layouts.set("ios", layout.replace("lineLimit(", "notARealModifier("));
    try {
      expect(() => render("ios", { snapshot: snapshot() })).toThrow(
        /notARealModifier/,
      );
    } finally {
      layouts.set("ios", layout);
    }
  });

  it.each(FAMILIES)(
    "renders every state in %s without broken values",
    (family) => {
      for (const [state, props] of Object.entries(states())) {
        for (const colorScheme of ["light", "dark"]) {
          const tree = render("ios", props, family, defaultConfiguration, {
            colorScheme,
          });
          // Something is drawn: text, or the refresh symbol a circle has room for.
          expect(
            texts(tree).length +
              nodes(tree).filter((node) => node.type === "Image").length,
            state,
          ).toBeGreaterThan(0);
          for (const value of strings(tree))
            expect(value, `${state} ${colorScheme}`).not.toMatch(
              /undefined|null|NaN|Invalid/,
            );
          expect(spokenLabel(tree), state).not.toBe("undefined");
        }
      }
    },
  );

  it.each(FAMILIES)("gives every symbol its own text style in %s", (family) => {
    for (const [state, props] of Object.entries(states())) {
      for (const image of nodes(render("ios", props, family)).filter(
        (node) => node.type === "Image",
      )) {
        // The brand mark is artwork, not a symbol: it needs resizable and a
        // frame, or it draws at the asset's own size.
        if (image.props.assetName) {
          expect(image.props.assetName, state).toBe("ConPawsMark");
          expect(
            image.props.modifiers?.some((item) => item.type === "resizable"),
            state,
          ).toBe(true);
          expect(modifierValue(image, "frame"), state).toMatchObject({
            width: 16,
            height: 16,
          });
          continue;
        }
        // Without one, Expo UI pins the symbol at a fixed 24pt.
        const style = modifierValue(image, "font") as
          | { textStyle?: string }
          | undefined;
        expect(
          style?.textStyle,
          `${state} ${image.props.systemName}`,
        ).toBeTruthy();
      }
    }
  });

  it.each(FAMILIES)(
    "shows the room on a row, never the venue beside it, in %s",
    (family) => {
      const data = snapshot();
      data.conventions[0].events = [
        event("a", 20 * MINUTE),
        event("b", 2 * HOUR),
        event("c", 3 * HOUR),
        event("d", 4 * HOUR),
      ];
      for (const tree of [
        render("ios", { snapshot: data }, family),
        render("ios", buildStoredWidgetTimeline(data)[0].props, family),
      ]) {
        const visible = texts(tree).join(" | ");
        expect(visible).not.toContain("Venue");
        if (family.startsWith("system")) expect(visible).toContain("Room a");
      }
    },
  );

  it("falls back to the venue only for an event with no room", () => {
    const data = snapshot();
    data.conventions[0].events[0].room = null;
    expect(texts(render("ios", { snapshot: data }))).toContain("Venue");
  });

  it("drops the weekday for today and keeps it for another day", () => {
    const data = snapshot();
    data.timeFormat = "12";
    data.conventions[0].events = [
      event("a", 20 * MINUTE, { reminderMinutes: null }),
      event("b", 26 * HOUR),
    ];
    const large = texts(render("ios", { snapshot: data }, "systemLarge"));
    expect(large).toContain("12:20 PM");
    expect(large).toContain("Tue 2:00 PM");
  });

  it.each(SYSTEM_FAMILIES)(
    "paints only the hero time in the accent colour in %s",
    (family) => {
      const cases: [string, ConPawsWidgetProps, string][] = [
        ["next", states().next, "12:20"],
        ["reminder", states().reminder, "12:10"],
        ["now", states().now, "12:50"],
        ["open", states().open, "11:50"],
        ["countdown", states().countdownDays, "5"],
        ["countdown", states().countdownTomorrow, "Tomorrow"],
      ];
      for (const [state, props, hero] of cases)
        for (const colorScheme of ["light", "dark"])
          expect(
            accentTexts(
              render("ios", props, family, defaultConfiguration, {
                colorScheme,
              }),
            ),
            `${state} ${colorScheme}`,
          ).toEqual([hero]);
    },
  );

  it.each(["accented", "vibrant"])(
    "uses no hard-coded accent in %s rendering",
    (widgetRenderingMode) => {
      for (const family of FAMILIES)
        for (const [state, props] of Object.entries(states()))
          for (const colorScheme of ["light", "dark"]) {
            const tree = JSON.stringify(
              render("ios", props, family, defaultConfiguration, {
                colorScheme,
                widgetRenderingMode,
              }),
            );
            for (const accent of ACCENTS)
              expect(tree, `${family} ${state}`).not.toContain(accent);
          }
    },
  );

  it.each(SYSTEM_FAMILIES)(
    "shows freshness only when the plan is stale in %s",
    (family) => {
      const fresh = render("ios", states().next, family);
      expect(texts(fresh).join(" ")).not.toMatch(/last updated|Open ConPaws/);
      expect(
        nodes(fresh).some(
          (node) => node.props.systemName === "arrow.clockwise",
        ),
      ).toBe(false);
      expect(spokenLabel(fresh)).not.toContain("last updated");

      const stale = render("ios", states().stale, family);
      const line = texts(stale).filter(
        (text) => text === "Open ConPaws to update your plan.",
      );
      expect(line).toHaveLength(1);
      expect(
        nodes(stale).some(
          (node) => node.props.systemName === "arrow.clockwise",
        ),
      ).toBe(true);
      // The time itself is spoken, not drawn.
      expect(spokenLabel(stale)).toContain("Plan last updated here");
      expect(texts(stale).join(" ")).not.toContain("last updated");
    },
  );

  it("puts the following events in a second block on medium", () => {
    const tree = render("ios", states().now, "systemMedium") as Node;
    expect(tree.type).toBe("HStack");
    const blocks = (tree.props.children as Node[]).filter(
      (child) => child?.type === "VStack",
    );
    expect(blocks).toHaveLength(2);
    expect(texts(blocks[0])).toContain("Panel a");
    expect(texts(blocks[0])).toContain("12:50");
    expect(texts(blocks[0])).not.toContain("Panel b");
    expect(texts(blocks[1])).toEqual(
      expect.arrayContaining(["UP NEXT", "Panel b", "14:00", "Panel c"]),
    );
    // With nothing later, the second block says so quietly.
    const last = render("ios", states().open, "systemMedium");
    expect(texts(last)).toContain("No later saved events");
  });

  it("ends the large agenda with the count of further events today", () => {
    const data = snapshot();
    data.conventions[0].events = [1, 2, 3, 4, 5, 6].map((hour) =>
      event(String(hour), hour * HOUR - 50 * MINUTE),
    );
    const [entry] = buildStoredWidgetTimeline(data);
    expect(entry.props.snapshot.conventions[0].remainingTodayCount).toBe(6);
    const visible = texts(render("ios", entry.props, "systemLarge"));
    // The hero and three rows are drawn; two more remain today.
    expect(visible).toEqual(
      expect.arrayContaining(["Panel 1", "Panel 2", "Panel 3", "Panel 4"]),
    );
    expect(visible).not.toContain("Panel 5");
    expect(visible).toContain("+2 more today");
    data.conventions[0].events = data.conventions[0].events.slice(0, 3);
    expect(
      texts(render("ios", { snapshot: data }, "systemLarge")).join(" "),
    ).not.toContain("more today");
  });

  it("makes the day count the countdown hero with its unit", () => {
    for (const family of SYSTEM_FAMILIES) {
      const visible = texts(render("ios", states().countdownDays, family));
      expect(visible).toEqual(
        expect.arrayContaining(["COMING UP", "5", "days", "Sample Con"]),
      );
    }
  });

  it("draws a progress bar only for a panel with a real end", () => {
    const bars = (props: ConPawsWidgetProps) =>
      nodes(render("ios", props, "systemSmall")).filter(
        (node) => node.type === "ProgressView",
      );
    const [bar] = bars(states().now);
    expect(bar.props.timerInterval).toEqual({
      lower: new Date(NOW - 10 * MINUTE),
      upper: new Date(NOW + 50 * MINUTE),
    });
    expect(bars(states().open)).toEqual([]);
    expect(bars(states().next)).toEqual([]);
  });
});

describe("Android widget design rules", () => {
  const emittable = readFileSync(
    path.join(
      widgetsRoot,
      "android/src/main/java/expo/modules/widgets/ExpoWidgetEmittableTree.kt",
    ),
    "utf8",
  );
  const drawables = path.join(
    nativeRoot,
    "modules/conpaws-widgets/android/src/main/res/drawable",
  );
  const LIGHT = {
    background: "#F0F1F2",
    foreground: "#101112",
    secondary: "#404142",
    accent: "#005575",
  };

  /** Every Android state, plus a plan the app has not refreshed for a day. */
  function androidStates(): Record<string, ConPawsWidgetProps> {
    const all = states();
    const stale = states().next;
    stale.snapshot.generatedAtMs = NOW - 13 * HOUR;
    return { ...all, stale };
  }

  function texts2(tree: unknown): Node[] {
    return nodes(tree).filter((node) => node.type === "TextView");
  }

  /** The hero card: the one Column painted with a background. */
  function heroCard(tree: unknown): Node | undefined {
    return nodes(tree).find(
      (node) =>
        node.type === "Column" &&
        node.props.modifiers?.some((item) => item.type === "background"),
    );
  }

  it("only uses components and modifiers the Glance tree converts", () => {
    expect(androidComponents.length).toBeGreaterThan(0);
    expect(androidModifiers.length).toBeGreaterThan(0);
    for (const name of androidComponents) {
      const built = readFileSync(
        path.join(
          uiRoot,
          "build/jetpack-compose",
          name.endsWith("ProgressIndicator") ? "Progress" : name,
          "index.js",
        ),
        "utf8",
      );
      const nativeType =
        built.match(
          new RegExp(
            `export const ${name} = create\\w+Component\\('(\\w+)'\\)`,
          ),
        )?.[1] ?? built.match(/requireNativeView\('ExpoUI', '(\w+)'\)/)?.[1];
      expect(nativeType, name).toBeTruthy();
      // Anything else becomes the "View not found" error text on the widget.
      expect(emittable, name).toMatch(new RegExp(`"${nativeType}"(,| ->)`));
    }
    for (const name of androidModifiers)
      expect(emittable, name).toContain(`"${name}" ->`);
  });

  it("finds every drawable the layout names in the module resources", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "ConPawsWidget.android.tsx"),
      "utf8",
    );
    const names = new Set(
      [...source.matchAll(/"(widget_\w+)"/g)].map(([, name]) => name),
    );
    expect([...names].sort()).toEqual(["widget_mark", "widget_refresh"]);
    for (const name of names)
      expect(readdirSync(drawables), name).toContain(`${name}.xml`);
  });

  it.each(["light", "dark"])(
    "renders every state with one root Button and bounded text (%s)",
    (colorScheme) => {
      for (const [state, props] of Object.entries(androidStates())) {
        const tree = render(
          "android",
          props,
          "systemSmall",
          defaultConfiguration,
          { colorScheme },
        ) as Node;
        // The provider opens the app only for Expo's first target.
        expect(tree.type, state).toBe("Button");
        expect(
          nodes(tree).filter((node) => node.type === "Button"),
          state,
        ).toHaveLength(1);
        expect(texts(tree).length, state).toBeGreaterThan(0);
        for (const value of strings(tree))
          expect(value, state).not.toMatch(
            /undefined|null|NaN|Invalid|\{\w+\}/,
          );
        for (const text of texts2(tree))
          expect(text.props.maxLines, `${state} ${text.props.text}`).toEqual(
            expect.any(Number),
          );
        for (const image of nodes(tree).filter(
          (node) => node.type === "Image",
        )) {
          expect(modifierValue(image, "size"), state).toEqual(
            expect.any(Number),
          );
          const uri = (image.props.source as { uri: string }).uri;
          expect(readdirSync(drawables), state).toContain(`${uri}.xml`);
        }
      }
    },
  );

  it.each(["next", "now", "reminder"])(
    "puts the hero time before the title in the %s card",
    (state) => {
      const card = heroCard(render("android", androidStates()[state]));
      const shown = texts(card);
      const time = shown.findIndex((text) => /\d{2}:\d{2}/.test(text));
      const title = shown.indexOf("Panel a");
      expect(time).toBeGreaterThanOrEqual(0);
      expect(title).toBeGreaterThan(time);
      // The hero is the largest text on the card.
      const sizes = texts2(card).map(
        (node) => (node.props.style as { fontSize: number }).fontSize,
      );
      expect(Math.max(...sizes)).toBe(sizes[time]);
    },
  );

  it("names the end while a panel runs and fills a bar from the real end", () => {
    const tree = render("android", androidStates().now);
    expect(texts(heroCard(tree))).toEqual(
      expect.arrayContaining(["Happening now", "Until 12:50", "Panel a"]),
    );
    const [bar] = nodes(tree).filter(
      (node) => node.type === "LinearProgressIndicator",
    );
    expect(bar.props.progress).toBeCloseTo(10 / 60);
    for (const state of ["open", "next", "countdownDays"])
      expect(
        nodes(render("android", androidStates()[state])).some(
          (node) => node.type === "LinearProgressIndicator",
        ),
        state,
      ).toBe(false);
  });

  it("shows the room, never the venue, and the venue only without a room", () => {
    const data = snapshot();
    data.conventions[0].events = [
      event("a", 20 * MINUTE),
      event("b", 2 * HOUR),
    ];
    const visible = texts(render("android", { snapshot: data }));
    expect(visible).toContain("Room a");
    expect(visible.join(" ")).not.toContain("Venue");
    data.conventions[0].events[0].room = null;
    expect(texts(render("android", { snapshot: data }))).toContain("Venue");
  });

  it("follows the hero with one line for the next event", () => {
    const visible = texts(render("android", androidStates().now));
    expect(visible).toContain("Next · 14:00 · Panel b");
    expect(visible.join(" ")).not.toContain("Panel c");
  });

  it("drops the weekday for today and keeps it for another day", () => {
    const data = snapshot();
    data.timeFormat = "12";
    data.conventions[0].events = [
      event("a", 20 * MINUTE),
      event("b", 26 * HOUR),
    ];
    const visible = texts(render("android", { snapshot: data }));
    expect(visible).toContain("12:20 PM");
    expect(visible).toContain("Next · Tue 2:00 PM · Panel b");
  });

  it.each(["12", "24"] as const)(
    "keeps both clocks of an overnight panel whole at 200%% text (W12, %s-hour)",
    (timeFormat) => {
      // 21:00 in Tokyo: a panel from 20:00 to 02:00 is running and the next
      // overnight one starts at 23:00 and ends at 01:00 the next day.
      const data = snapshot();
      data.timeFormat = timeFormat;
      data.conventions[0].timeZoneIdentifier = "Asia/Tokyo";
      data.conventions[0].events = [
        event("a", -HOUR, { endAtMs: NOW + 5 * HOUR }),
        event("b", 2 * HOUR, { endAtMs: NOW + 4 * HOUR }),
      ];
      const tree = render("android", { snapshot: data });
      const end = timeFormat === "12" ? "2:00 AM" : "02:00";
      const start = timeFormat === "12" ? "11:00 PM" : "23:00";
      const all = texts2(tree);
      const hero = all.find((node) => String(node.props.text).includes(end));
      const then = all.find((node) => String(node.props.text).includes(start));
      for (const [node, clock] of [
        [hero, end],
        [then, `Next · ${start}`],
      ] as const) {
        expect(node, clock).toBeDefined();
        const text = String(node?.props.text);
        // No no-break space: Android would break inside the digits instead.
        expect(text).not.toMatch(/[  ]/);
        // Every word may take its own line before anything is cut, so a
        // 180dp widget at 200% wraps a clock rather than ending it in "…".
        expect(node?.props.maxLines as number).toBeGreaterThanOrEqual(
          text === String(hero?.props.text) ? text.split(" ").length : 2,
        );
      }
      expect(String(hero?.props.text)).toBe(`Until Tue ${end}`);
      // The header and title may truncate at that extreme; nothing else must.
      expect(texts(tree)).toContain("Sample Con");
    },
  );

  it("shows the stale strip only when the plan is old", () => {
    const strip = (props: ConPawsWidgetProps) =>
      nodes(render("android", props)).some(
        (node) =>
          node.type === "Image" &&
          (node.props.source as { uri: string }).uri === "widget_refresh",
      );
    const fresh = androidStates().next;
    expect(strip(fresh)).toBe(false);
    expect(texts(render("android", fresh)).join(" ")).not.toContain("checked");
    const recent = androidStates().next;
    recent.snapshot.generatedAtMs = NOW - 2 * HOUR;
    expect(strip(recent)).toBe(false);
    const old = androidStates().stale;
    expect(strip(old)).toBe(true);
    // The device's own clock, since it says when this phone last refreshed.
    expect(texts(render("android", old))).toContain(
      `checked ${new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
        ...(new Date(NOW - 13 * HOUR).toDateString() ===
        new Date(NOW).toDateString()
          ? {}
          : { month: "short", day: "numeric" }),
      }).format(new Date(NOW - 13 * HOUR))}`,
    );
    for (const state of ["countdownDays", "finished", "noPicks"]) {
      const props = androidStates()[state];
      props.snapshot.generatedAtMs = NOW - 2 * 86_400_000;
      expect(strip(props), state).toBe(true);
    }
  });

  it("makes the day count the countdown hero with its unit", () => {
    const tree = render("android", androidStates().countdownDays);
    expect(texts(heroCard(tree))).toEqual(["5", "days", "Nov 15–17"]);
    expect(
      texts(render("android", androidStates().countdownTomorrow)),
    ).toContain("Tomorrow");
  });

  it("centres a glyph, headline and hint in the empty states", () => {
    const cases: [string, string, string][] = [
      ["empty", "No conventions yet", "Find your convention"],
      ["noPicks", "No panels picked yet", "Browse a convention"],
      ["finished", "You're all caught up", "at Sample Con have ended"],
      ["invalid", "ConPaws", "checked "],
      ["expired", "ConPaws", "checked "],
    ];
    for (const [state, title, hint] of cases) {
      const tree = render("android", androidStates()[state]) as Node;
      const column = (tree.props.children as Node) ?? tree;
      expect(column.props.verticalAlignment, state).toBe("center");
      const shown = texts(tree);
      expect(shown[0], state).toBe(title);
      expect(shown[1], state).toContain(hint);
      expect(nodes(tree).filter((node) => node.type === "Image")).toHaveLength(
        1,
      );
    }
  });

  it("uses translated templates from the presentation labels", () => {
    const data = snapshot();
    data.conventions[0].events = [event("a", -10 * MINUTE), event("b", HOUR)];
    data.presentation = {
      appearance: "system",
      palette: { light: LIGHT, dark: LIGHT },
      labels: {
        next: "Als Nächstes",
        current: "Läuft gerade",
        noEvents: "Keine",
        finished: "Fertig",
        until: "Bis {time}",
        nextAt: "Danach · {time}",
      },
    };
    const visible = texts(render("android", { snapshot: data }));
    expect(visible).toEqual(
      expect.arrayContaining([
        "Läuft gerade",
        "Bis 12:50",
        "Danach · 13:00 · Panel b",
      ]),
    );
  });

  it("derives the container roles for a snapshot stored before they existed", () => {
    const data = snapshot();
    data.presentation = {
      appearance: "dark",
      palette: {
        light: LIGHT,
        dark: { ...LIGHT, background: "#000000", accent: "#18B7F2" },
      },
      labels: {
        next: "Next",
        current: "Now",
        noEvents: "None",
        finished: "Done",
      },
    };
    const card = heroCard(render("android", { snapshot: data }));
    // 16% of #18B7F2 over black, chosen by the dark appearance override.
    expect(modifierValue(card as Node, "background")).toBe("#041d27");
    const bar = nodes(render("android", androidStates().now)).find(
      (node) => node.type === "LinearProgressIndicator",
    );
    expect(bar?.props.trackColor).toMatch(/^#[0-9a-f]{6}$/i);

    data.presentation.palette.dark = {
      ...data.presentation.palette.dark,
      container: "#123456",
      onContainer: "#FEDCBA",
      track: "#222222",
    };
    const fresh = heroCard(render("android", { snapshot: data }));
    expect(modifierValue(fresh as Node, "background")).toBe("#123456");
    expect(texts2(fresh).every((node) => node.props.color === "#FEDCBA")).toBe(
      true,
    );
  });
});
