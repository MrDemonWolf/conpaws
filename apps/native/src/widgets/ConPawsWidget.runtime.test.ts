import { readFileSync } from "node:fs";
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
  for (const name of [
    "AccessoryWidgetBackground",
    "Divider",
    "Gauge",
    "HStack",
    "Image",
    "Spacer",
    "VStack",
    "ZStack",
    "Button",
    "Column",
  ])
    globals[name] = component(name);
  globals.Text = component("TextView");
  for (const name of [
    "accessibilityElement",
    "accessibilityHint",
    "accessibilityLabel",
    "containerBackground",
    "font",
    "foregroundStyle",
    "gaugeStyle",
    "layoutPriority",
    "lineLimit",
    "monospacedDigit",
    "widgetURL",
    "cornerRadius",
    "fillMaxSize",
    "paddingAll",
  ])
    globals[name] = (...values: unknown[]) => ({ type: name, values });
  globals.__props = props;
  globals.__environment = {
    date: new Date(NOW),
    widgetFamily: family,
    configuration,
    colorScheme: "light",
    widgetRenderingMode: "fullColor",
  };
  const context = vm.createContext(globals);
  const tree = vm.runInContext(
    `(${layouts.get(platform)})(__props, __environment)`,
    context,
    { timeout: 5_000 },
  );
  function normalize(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(normalize);
    if (!node || typeof node !== "object") return node;
    const value = node as { type?: unknown; props?: Record<string, unknown> };
    if (typeof value.type === "function")
      return normalize(value.type(value.props));
    return Object.fromEntries(
      Object.entries(node).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return normalize(tree);
}

function texts(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (!node || typeof node !== "object") return [];
  const value = node as { type?: string; props?: { text?: string } };
  const own =
    value.type === "TextView" && typeof value.props?.text === "string"
      ? [value.props.text]
      : [];
  return own.concat(Object.values(node).flatMap(texts));
}

describe("isolated Expo widget renderers", () => {
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

  it("labels circular next events and reminder minutes truthfully", () => {
    const data = snapshot();
    data.conventions[0].events[0].reminderMinutes = null;
    const next = texts(
      render("ios", { snapshot: data }, "accessoryCircular"),
    ).join(" ");
    expect(next).toContain("UP NEXT");
    expect(next).not.toContain("HAPPENING NOW");
    data.conventions[0].events[0].title = "🐺 Opening";
    expect(
      texts(render("ios", { snapshot: data }, "accessoryCircular")),
    ).toContain("🐺");
    data.conventions[0].events[0].reminderMinutes = 15;
    expect(
      texts(render("ios", { snapshot: data }, "accessoryCircular")),
    ).toContain("10");
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
