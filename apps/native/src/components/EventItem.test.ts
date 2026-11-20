import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "EventItem.tsx"), "utf8");
const starActionName = source.match(
  /accessibilityActions=\{[\s\S]*?name:\s*"(\w+)"/,
)?.[1];

describe("EventItem accessibility actions", () => {
  it("gives the row's star a custom action name, so TalkBack's double-tap still opens the event", () => {
    // On Android "activate" becomes the row's click action: double-tap then
    // ran the star (saving or unsaving the event) instead of opening it.
    expect(source).not.toMatch(/name:\s*"activate"/);
    expect(source).not.toMatch(/actionName === "activate"/);
    expect(starActionName).toBeDefined();
    expect(source).toContain(`actionName === "${starActionName}"`);
  });

  it("avoids every name the installed Android delegate maps onto a standard action", () => {
    const rnRoot = path.dirname(require.resolve("react-native/package.json"));
    const delegate = readFileSync(
      path.join(
        rnRoot,
        "ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.kt",
      ),
      "utf8",
    );
    expect(delegate).toContain(
      '"activate" to AccessibilityActionCompat.ACTION_CLICK.id',
    );
    const reserved = [
      ...delegate.matchAll(/"(\w+)" to AccessibilityActionCompat\./g),
    ].map((match) => match[1]);
    expect(reserved).toEqual(
      expect.arrayContaining([
        "activate",
        "longpress",
        "increment",
        "decrement",
        "expand",
        "collapse",
      ]),
    );
    expect(reserved).not.toContain(starActionName);
  });
});
