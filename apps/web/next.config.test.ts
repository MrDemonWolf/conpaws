import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("Next image optimizer policy", () => {
  it("keeps optimization disabled while Next 16.2.12 is pinned", () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });
});
