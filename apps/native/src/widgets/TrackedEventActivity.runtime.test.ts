import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import type { File } from "@babel/types";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  TRACKED_EVENT_ACTIVITY_NAME,
  TRACKED_EVENT_STOP_TARGET,
  type TrackedEventProps,
} from "@/lib/tracked-event.types";

const require = createRequire(import.meta.url);
const babel: {
  transformSync(
    source: string,
    options: Record<string, unknown>,
  ): { ast?: File } | null;
} = require("@babel/core");
const NOW = Date.parse("2026-11-16T12:00:00Z");
const MINUTE = 60_000;
const filename = path.join(import.meta.dirname, "TrackedEventActivity.ios.tsx");
const source = readFileSync(filename, "utf8");
const uiRoot = path.dirname(require.resolve("@expo/ui/package.json"));
const widgetsRoot = path.dirname(require.resolve("expo-widgets/package.json"));
const regions = [
  "banner",
  "bannerSmall",
  "compactLeading",
  "compactTrailing",
  "minimal",
  "expandedLeading",
  "expandedCenter",
  "expandedTrailing",
  "expandedBottom",
] as const;
type Region = (typeof regions)[number];

let layout = "";
let components: string[] = [];
let modifiers: string[] = [];

beforeAll(() => {
  const result = babel.transformSync(source, {
    filename,
    configFile: false,
    babelrc: false,
    ast: true,
    plugins: [
      [require.resolve("@babel/plugin-transform-typescript"), { isTSX: true }],
      [
        require.resolve("@babel/plugin-transform-react-jsx"),
        { runtime: "automatic" },
      ],
      require("babel-preset-expo/build/plugins/widgets-plugin").widgetsPlugin,
    ],
  });
  const body = result?.ast?.program.body ?? [];
  const declaration = body.find(
    (node) =>
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "VariableDeclaration" &&
      node.declaration.declarations.some(
        (item) =>
          item.id.type === "Identifier" &&
          item.id.name === "TrackedEventActivityLayout",
      ),
  );
  if (
    declaration?.type !== "ExportNamedDeclaration" ||
    declaration.declaration?.type !== "VariableDeclaration"
  )
    throw new Error("Widget directive was not serialized");
  const init = declaration.declaration.declarations[0].init;
  if (init?.type !== "TemplateLiteral")
    throw new Error("Expected isolated Live Activity source");
  layout = init.quasis[0].value.cooked ?? "";
  // The stand-ins below are exactly what the file imports, so a name the
  // isolated runtime would not have fails here instead of silently on device.
  for (const node of body) {
    if (node.type !== "ImportDeclaration") continue;
    const names = node.specifiers.map((item) => item.local.name);
    if (node.source.value === "@expo/ui/swift-ui") components = names;
    if (node.source.value === "@expo/ui/swift-ui/modifiers") modifiers = names;
  }
}, 30_000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function props(overrides: Partial<TrackedEventProps> = {}): TrackedEventProps {
  const startAtMs = NOW + 30 * MINUTE;
  const endAtMs = NOW + 90 * MINUTE;
  return {
    eventId: "panel",
    conventionId: "con",
    title: "Opening Ceremony",
    conventionName: "Sample Con",
    place: "Main Hall",
    startAtMs,
    endAtMs,
    cleanupAtMs: endAtMs,
    timeLabel: "12:30 PM – 1:30 PM",
    labels: {
      startsIn: "Starts in",
      endsIn: "Ends in",
      now: "Now",
      ended: "Ended",
      stop: "Stop",
      channelName: "Tracked event",
      channelDescription: "Shows the one event you chose to track.",
    },
    url: "conpaws://convention/con?highlightEventId=panel",
    ...overrides,
  };
}

interface Node {
  type: string;
  props: Record<string, unknown> & {
    modifiers?: { type: string; values: unknown[] }[];
  };
}

function render(
  input: TrackedEventProps,
  environment: Record<string, unknown> = { colorScheme: "light" },
): Record<Region, unknown> {
  // This runs the real Expo Babel serialization in an isolated VM. Components
  // and modifiers are bounded test doubles; the native render is not checked.
  const jsx = (type: unknown, nodeProps: Record<string, unknown>) => ({
    type,
    props: nodeProps,
  });
  const component = (name: string) => (nodeProps: Record<string, unknown>) => ({
    type: name,
    props:
      name === "Text" && nodeProps.timerInterval == null
        ? { ...nodeProps, text: nodeProps.children }
        : nodeProps,
  });
  const globals: Record<string, unknown> = {
    Date,
    console,
    _jsx: jsx,
    _jsxs: jsx,
    _Fragment: "Fragment",
  };
  for (const name of components) globals[name] = component(name);
  for (const name of modifiers)
    globals[name] = (...values: unknown[]) => ({ type: name, values });
  // JSON is what crosses into the runtime, so the test does the same.
  globals.__props = JSON.parse(JSON.stringify(input));
  globals.__environment = environment;
  const context = vm.createContext(globals);
  const tree = vm.runInContext(`(${layout})(__props, __environment)`, context, {
    timeout: 5_000,
  });
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
  return normalize(tree) as Record<Region, unknown>;
}

function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || tree instanceof Date) return [];
  const value = tree as Partial<Node>;
  const own =
    typeof value.type === "string" && value.props ? [value as Node] : [];
  return own.concat(Object.values(tree).flatMap(nodes));
}

function texts(tree: unknown): string[] {
  return nodes(tree)
    .filter(
      (node) => node.type === "Text" && typeof node.props.text === "string",
    )
    .map((node) => node.props.text as string);
}

function timers(tree: unknown) {
  return nodes(tree)
    .filter((node) => node.type === "Text" && node.props.timerInterval != null)
    .map((node) => node.props.timerInterval as { lower: Date; upper: Date });
}

function progress(tree: unknown) {
  return nodes(tree)
    .filter((node) => node.type === "ProgressView")
    .map((node) => node.props.timerInterval as { lower: Date; upper: Date });
}

/** Every string the layout could show or speak: text, labels and modifier arguments. */
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

function expectNoBrokenValues(tree: unknown) {
  for (const value of strings(tree))
    expect(value).not.toMatch(/undefined|null|NaN|Invalid/);
  for (const interval of [...timers(tree), ...progress(tree)]) {
    expect(Number.isFinite(interval.lower.getTime())).toBe(true);
    expect(Number.isFinite(interval.upper.getTime())).toBe(true);
  }
}

describe("isolated Live Activity layout", () => {
  it("only uses components and modifiers the installed Expo UI declares and renders", () => {
    expect(components.length).toBeGreaterThan(0);
    expect(modifiers.length).toBeGreaterThan(0);
    const renderer = readFileSync(
      path.join(widgetsRoot, "ios/Widgets/ViewRenderer.swift"),
      "utf8",
    );
    for (const name of components) {
      const built = readFileSync(
        path.join(uiRoot, "build/swift-ui", name, "index.js"),
        "utf8",
      );
      const nativeType = built.match(
        /requireNativeView\('ExpoUI', '(\w+)'\)/,
      )?.[1];
      expect(nativeType, name).toBeTruthy();
      // A type missing from the Live Activity renderer draws nothing in release.
      expect(renderer, name).toContain(`case "${nativeType}":`);
    }
    const modifierDir = path.join(uiRoot, "build/swift-ui/modifiers");
    const declarations = readdirSync(modifierDir)
      .filter((file) => file.endsWith(".d.ts"))
      .map((file) => readFileSync(path.join(modifierDir, file), "utf8"))
      .join("\n");
    const registry = readFileSync(
      path.join(uiRoot, "ios/Modifiers/ViewModifierRegistry.swift"),
      "utf8",
    );
    for (const name of modifiers) {
      expect(declarations, name).toMatch(
        new RegExp(`export declare (const|function) ${name}\\b`),
      );
      expect(registry, name).toContain(`register("${name}")`);
    }
  });

  it("registers the shared activity name and writes the exact stop target", () => {
    expect(source).toMatch(
      /createLiveActivity<TrackedEventProps>\(\s*TRACKED_EVENT_ACTIVITY_NAME,\s*TrackedEventActivityLayout,?\s*\)/,
    );
    expect(TRACKED_EVENT_ACTIVITY_NAME).toBe("ConPawsTrackedEvent");
    const targets = [...source.matchAll(/target="([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets)
      expect(target).toBe(TRACKED_EVENT_STOP_TARGET);
    // Imported constants do not exist in the isolated runtime.
    expect(layout).not.toContain("TRACKED_EVENT_");
    expect(layout).toContain(TRACKED_EVENT_STOP_TARGET);
  });

  it.each([
    ["upcoming", props()],
    [
      "running",
      props({
        startAtMs: NOW - 10 * MINUTE,
        endAtMs: NOW + 50 * MINUTE,
        cleanupAtMs: NOW + 50 * MINUTE,
      }),
    ],
    [
      "open",
      props({
        startAtMs: NOW - 10 * MINUTE,
        endAtMs: null,
        cleanupAtMs: NOW + 50 * MINUTE,
        timeLabel: "11:50 AM",
      }),
    ],
    [
      "ended",
      props({
        startAtMs: NOW - 2 * 60 * MINUTE,
        endAtMs: NOW - 60 * MINUTE,
        cleanupAtMs: NOW - 60 * MINUTE,
      }),
    ],
  ] as const)(
    "renders every region with a Stop button: %s",
    (_phase, input) => {
      const tree = render(input);
      for (const region of regions) {
        expect(tree[region], region).toBeTruthy();
        expect(nodes(tree[region]).length, region).toBeGreaterThan(0);
      }
      for (const region of ["banner", "expandedBottom"] as const) {
        const buttons = nodes(tree[region]).filter(
          (node) => node.type === "Button",
        );
        expect(buttons, region).toHaveLength(1);
        expect(buttons[0].props.target).toBe(TRACKED_EVENT_STOP_TARGET);
        expect(buttons[0].props.label).toBe("Stop");
      }
      const banner = texts(tree.banner);
      expect(banner).toContain("Sample Con");
      expect(banner).toContain("Opening Ceremony");
      expectNoBrokenValues(tree);
    },
  );

  it("counts down to the start before the event", () => {
    const input = props();
    const tree = render(input);
    expect(texts(tree.banner)).toContain("Starts in");
    expect(texts(tree.banner)).toContain("12:30 PM – 1:30 PM");
    for (const region of [
      "banner",
      "bannerSmall",
      "compactTrailing",
      "expandedTrailing",
    ] as const) {
      const [timer] = timers(tree[region]);
      expect(timer, region).toBeDefined();
      expect(timer.upper.getTime()).toBe(input.startAtMs);
      expect(timer.lower.getTime()).toBeLessThanOrEqual(timer.upper.getTime());
    }
    expect(progress(tree)).toEqual([]);
  });

  it("counts down to the real end with a start-to-end progress bar while running", () => {
    const input = props({
      startAtMs: NOW - 10 * MINUTE,
      endAtMs: NOW + 50 * MINUTE,
      cleanupAtMs: NOW + 50 * MINUTE,
    });
    const tree = render(input);
    expect(texts(tree.banner)).toContain("Ends in");
    expect(texts(tree.banner)).not.toContain("Starts in");
    for (const region of [
      "banner",
      "bannerSmall",
      "compactTrailing",
      "expandedTrailing",
    ] as const) {
      const [timer] = timers(tree[region]);
      expect(timer, region).toBeDefined();
      expect(timer.upper.getTime()).toBe(input.endAtMs);
      expect(timer.lower.getTime()).toBeLessThanOrEqual(timer.upper.getTime());
    }
    const bars = progress(tree.banner);
    expect(bars).toHaveLength(1);
    expect(bars[0].lower.getTime()).toBe(input.startAtMs);
    expect(bars[0].upper.getTime()).toBe(input.endAtMs);
  });

  it("shows Now without a timer, progress or invented end when there is no end time", () => {
    const input = props({
      startAtMs: NOW - 10 * MINUTE,
      endAtMs: null,
      cleanupAtMs: NOW + 50 * MINUTE,
      timeLabel: "11:50 AM",
    });
    const tree = render(input);
    expect(texts(tree.banner)).toContain("Now");
    expect(texts(tree.compactTrailing)).toEqual(["Now"]);
    expect(timers(tree)).toEqual([]);
    expect(progress(tree)).toEqual([]);
    const shown = strings(tree).join(" ");
    expect(shown).not.toContain("Ends in");
    // The cleanup hour is never shown as an end time.
    expect(shown).not.toMatch(/12:50/);
    expect(JSON.stringify(tree)).not.toContain(String(input.cleanupAtMs));
  });

  it.each([
    ["after cleanup", { colorScheme: "light" }],
    ["after cleanup and stale", { colorScheme: "light", isStale: true }],
  ])("shows Ended with no timers %s", (_case, environment) => {
    for (const input of [
      props({
        startAtMs: NOW - 2 * 60 * MINUTE,
        endAtMs: NOW - 60 * MINUTE,
        cleanupAtMs: NOW - 60 * MINUTE,
      }),
      props({
        startAtMs: NOW - 60 * MINUTE,
        endAtMs: null,
        cleanupAtMs: NOW,
      }),
    ]) {
      const tree = render(input, environment);
      expect(texts(tree.banner)).toContain("Ended");
      expect(texts(tree.compactTrailing)).toEqual(["Ended"]);
      expect(timers(tree)).toEqual([]);
      expect(progress(tree)).toEqual([]);
      expectNoBrokenValues(tree);
    }
  });

  it("keeps a stale activity before cleanup on its countdown", () => {
    const input = props({
      startAtMs: NOW - 10 * MINUTE,
      endAtMs: NOW + 50 * MINUTE,
      cleanupAtMs: NOW + 50 * MINUTE,
    });
    const tree = render(input, { colorScheme: "light", isStale: true });
    expect(texts(tree.banner)).toContain("Ends in");
    expect(timers(tree.banner)).toHaveLength(1);
  });

  it("omits the separator when there is no place", () => {
    const tree = render(props({ place: null }));
    expect(texts(tree.banner)).toContain("12:30 PM – 1:30 PM");
    expect(texts(tree.expandedBottom)).toContain("12:30 PM – 1:30 PM");
    expect(strings(tree).join(" ")).not.toContain(" · ");
    expectNoBrokenValues(tree);
  });

  it("gives the time and the place a line each, so neither cuts the other", () => {
    const input = props({ place: "Grand Ballroom Salon C, Level 3" });
    const tree = render(input);
    for (const region of ["banner", "expandedBottom"] as const) {
      const lines = nodes(tree[region]).filter(
        (node) =>
          node.type === "Text" &&
          (node.props.text === input.timeLabel ||
            node.props.text === input.place),
      );
      expect(
        lines.map((node) => node.props.text),
        region,
      ).toEqual([input.timeLabel, input.place]);
      for (const line of lines)
        expect(
          line.props.modifiers?.find((item) => item.type === "lineLimit")
            ?.values[0],
        ).toBe(1);
    }
  });

  it("uses the bright accent on the dark activity surfaces in both appearances", () => {
    const running = props({
      startAtMs: NOW - 10 * MINUTE,
      endAtMs: NOW + 50 * MINUTE,
      cleanupAtMs: NOW + 50 * MINUTE,
    });
    for (const colorScheme of ["light", "dark"]) {
      const tree = render(running, { colorScheme });
      expect(JSON.stringify(tree)).not.toContain("#00618A");
      const [timer] = nodes(tree.banner).filter(
        (node) => node.type === "Text" && node.props.timerInterval != null,
      );
      expect(timer.props.modifiers).toContainEqual({
        type: "foregroundStyle",
        values: ["#18B7F2"],
      });
      for (const type of ["ProgressView", "Button"])
        expect(
          nodes(tree.banner).find((node) => node.type === type)?.props
            .modifiers,
          `${colorScheme} ${type}`,
        ).toContainEqual({ type: "tint", values: ["#18B7F2"] });
    }
  });

  it("labels the Stop button and the symbol where the title is not visible", () => {
    const tree = render(props());
    const [button] = nodes(tree.banner).filter(
      (node) => node.type === "Button",
    );
    expect(
      button.props.modifiers?.find((item) => item.type === "accessibilityLabel")
        ?.values[0],
    ).toBe("Stop, Opening Ceremony");
    for (const region of ["compactLeading", "minimal"] as const) {
      const [image] = nodes(tree[region]).filter(
        (node) => node.type === "Image",
      );
      expect(image.props.systemName).toBe("calendar.badge.clock");
      expect(
        image.props.modifiers?.find(
          (item) => item.type === "accessibilityLabel",
        )?.values[0],
      ).toBe("Opening Ceremony, Starts in");
    }
  });
});
