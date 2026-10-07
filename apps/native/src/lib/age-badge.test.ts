import { describe, expect, it } from "vitest";
import { ageBadgeFor } from "./age-badge";

describe("ageBadgeFor", () => {
  it("maps restricted ratings to their shared badge", () => {
    expect(ageBadgeFor("mature")).toEqual({
      variant: "age-mature",
      key: "convention.ageRatings.mature",
    });
  });

  it("omits unrestricted and missing ratings", () => {
    expect(ageBadgeFor("all-ages")).toBeUndefined();
    expect(ageBadgeFor(null)).toBeUndefined();
  });
});
