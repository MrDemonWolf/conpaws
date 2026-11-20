import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { compile } from "react-native-css/compiler";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

const nativeRoot = path.resolve(__dirname, "../../..");

/** Material asks 48dp and HIG 44pt, so 48 satisfies both. */
const MIN_TARGET = 48;

const TAP_TARGET = readFileSync(path.join(__dirname, "Row.tsx"), "utf8").match(
  /export const TAP_TARGET = "([^"]+)";/,
)?.[1];

/** Utilities that set a box size: `min-h-12`, `h-[48px]`, `size-11`. */
const SIZE_CLASS = /^(?:min-)?(?:h|w|size)-/;

type Box = Partial<
  Record<"width" | "height" | "minWidth" | "minHeight", number>
>;

interface Tappable {
  where: string;
  classes: string[];
  style: Box;
  /** Only a glyph inside: no text says where a tap may land. */
  iconOnly: boolean;
}

function sourceFiles(): string[] {
  return ["app", "src"]
    .flatMap((dir) =>
      (
        readdirSync(path.join(nativeRoot, dir), { recursive: true }) as string[]
      ).map((file) => path.join(nativeRoot, dir, file)),
    )
    .filter((file) => /\.tsx$/.test(file) && !/\.test\.tsx$/.test(file));
}

/** Every class a `className` expression can produce, whichever branch runs. */
function classTokens(node: ts.Node | undefined, out: string[] = []): string[] {
  if (!node) return out;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.push(...node.text.split(/\s+/));
  } else if (ts.isTemplateExpression(node)) {
    out.push(...node.head.text.split(/\s+/));
    for (const span of node.templateSpans) {
      classTokens(span.expression, out);
      out.push(...span.literal.text.split(/\s+/));
    }
  } else if (ts.isIdentifier(node)) {
    if (node.text === "TAP_TARGET" && TAP_TARGET) out.push(TAP_TARGET);
  } else if (ts.isCallExpression(node)) {
    for (const argument of node.arguments) classTokens(argument, out);
  } else {
    node.forEachChild((child) => {
      classTokens(child, out);
    });
  }
  return out.filter(Boolean);
}

function attribute(
  element: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  return element.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

/** Numeric width and height keys of an inline `style={{ ... }}` literal. */
function inlineBox(element: ts.JsxOpeningLikeElement): Box {
  const value = attribute(element, "style")?.initializer;
  const literal =
    value && ts.isJsxExpression(value) ? value.expression : undefined;
  const box: Box = {};
  if (!literal || !ts.isObjectLiteralExpression(literal)) return box;
  for (const property of literal.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isNumericLiteral(property.initializer) &&
      ["width", "height", "minWidth", "minHeight"].includes(
        property.name.getText(),
      )
    ) {
      box[property.name.getText() as keyof Box] = Number(
        property.initializer.text,
      );
    }
  }
  return box;
}

function rendersText(element: ts.JsxElement): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isJsxText(node)) {
      found = node.text.trim() !== "";
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      // `{label}` or `{children}`: assume it may be words.
      found = true;
    } else if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      /Text$/.test(node.tagName.getText())
    ) {
      found = true;
    } else {
      node.forEachChild(visit);
    }
  };
  for (const child of element.children) visit(child);
  return found;
}

/** Every `<Pressable>` and every element with an `onPress`, app-wide. */
function tappables(): Tappable[] {
  const found: Tappable[] = [];
  for (const file of sourceFiles()) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : undefined;
      if (
        opening &&
        (opening.tagName.getText() === "Pressable" ||
          attribute(opening, "onPress"))
      ) {
        const { line } = source.getLineAndCharacterOfPosition(
          opening.getStart(),
        );
        found.push({
          where: `${path.relative(nativeRoot, file)}:${line + 1}`,
          classes: classTokens(attribute(opening, "className")?.initializer),
          style: inlineBox(opening),
          iconOnly:
            opening.tagName.getText() === "Pressable" &&
            ts.isJsxElement(node) &&
            !rendersText(node),
        });
      }
      node.forEachChild(visit);
    };
    visit(source);
  }
  return found;
}

/**
 * What NativeWind hands React Native for each class, through the app's own
 * `global.css`, Tailwind and the installed react-native-css compiler. That
 * compiler takes 1rem as 14px (global.css sets no root font size), so
 * `min-h-12` is 42 on a device, not the 48 it is on the web.
 */
async function nativeBoxes(classes: string[]): Promise<Map<string, Box>> {
  const file = path.join(nativeRoot, "src/global.css");
  const css = `${readFileSync(file, "utf8")}\n@source inline(${JSON.stringify(
    classes.join(" "),
  )});\n`;
  const web = await postcss([tailwindcss({ base: nativeRoot })]).process(css, {
    from: file,
  });
  const boxes = new Map<string, Box>();
  for (const [name, rules] of compile(web.css).stylesheet().s ?? []) {
    const box: Box = {};
    for (const declaration of rules.flatMap((rule) => rule.d ?? [])) {
      if (Array.isArray(declaration)) continue;
      for (const key of ["width", "height", "minWidth", "minHeight"] as const)
        if (typeof declaration[key] === "number") box[key] = declaration[key];
    }
    boxes.set(name, box);
  }
  return boxes;
}

describe("tap targets on native", () => {
  const controls = tappables();
  let boxes = new Map<string, Box>();

  beforeAll(async () => {
    boxes = await nativeBoxes([
      ...new Set(controls.flatMap((control) => control.classes)),
    ]);
  });

  /** The box a control gets from its classes and inline style together. */
  function box(control: Tappable): Required<Pick<Box, "width" | "height">> {
    const merged: Box = { ...control.style };
    for (const name of control.classes) {
      for (const [key, value] of Object.entries(boxes.get(name) ?? {})) {
        merged[key as keyof Box] = Math.max(
          merged[key as keyof Box] ?? 0,
          value,
        );
      }
    }
    return {
      width: Math.max(merged.width ?? 0, merged.minWidth ?? 0),
      height: Math.max(merged.height ?? 0, merged.minHeight ?? 0),
    };
  }

  it("scans the app's controls", () => {
    expect(controls.length).toBeGreaterThan(50);
    expect(controls.filter((control) => control.iconOnly).length).toBe(4);
  });

  it("makes TAP_TARGET at least 48 tall on a device", () => {
    expect(TAP_TARGET).toBeDefined();
    expect(boxes.get(TAP_TARGET ?? "")?.minHeight).toBeGreaterThanOrEqual(
      MIN_TARGET,
    );
  });

  it("sizes no control below 48 with a class", () => {
    // Includes a Button caller's `min-h-*`: tailwind-merge drops Button's own
    // `min-h-[48px]` in favour of it, so a smaller one shrinks the button.
    const undersized = controls.flatMap((control) =>
      control.classes
        .filter((name) => SIZE_CLASS.test(name))
        .filter((name) =>
          Object.values(boxes.get(name) ?? {}).some(
            (value) => value < MIN_TARGET,
          ),
        )
        .map((name) => `${control.where} ${name}`),
    );
    expect(undersized).toEqual([]);
  });

  it("gives every icon-only control a 48 by 48 box of its own", () => {
    // hitSlop does not count: accessibility scanners measure the view, and a
    // slop reaching past the parent is not hit-tested on Android.
    const undersized = controls
      .filter((control) => control.iconOnly)
      .map((control) => ({ where: control.where, ...box(control) }))
      .filter(({ width, height }) => width < MIN_TARGET || height < MIN_TARGET);
    expect(undersized).toEqual([]);
  });
});
