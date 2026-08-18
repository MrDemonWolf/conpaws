import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const conventionRoute = path.resolve(__dirname, "../../app/convention/[id]");

describe("Expo Router convention routes", () => {
  it("uses one detail route with its nested import screen", () => {
    expect(existsSync(`${conventionRoute}.tsx`)).toBe(true);
    expect(existsSync(path.join(conventionRoute, "_layout.tsx"))).toBe(false);
    expect(existsSync(path.join(conventionRoute, "import.tsx"))).toBe(true);
  });
});
