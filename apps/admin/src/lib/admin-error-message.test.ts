import { describe, expect, it } from "vitest";
import { adminErrorMessage } from "./admin-error-message";

describe("adminErrorMessage", () => {
  it("maps slug and missing redirects to visible messages", () => {
    expect(adminErrorMessage("slug")).toMatch(/slug is already in use/);
    expect(adminErrorMessage("missing")).toMatch(/no longer exists/);
    expect(adminErrorMessage("other")).toBeNull();
  });
});
