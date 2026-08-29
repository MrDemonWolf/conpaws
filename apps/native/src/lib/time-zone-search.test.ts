import { describe, expect, it } from "vitest";
import {
  buildTimeZoneOptions,
  describeTimeZone,
  normalizeForSearch,
  searchTimeZones,
  timeZoneLabel,
} from "./time-zone-search";

const IDS = [
  "America/Chicago",
  "America/New_York",
  "America/Indiana/Indianapolis",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Tokyo",
  "UTC",
];

const OPTIONS = IDS.map(describeTimeZone);

function ids(query: string): string[] {
  return searchTimeZones(OPTIONS, query).map((option) => option.id);
}

describe("describeTimeZone", () => {
  it("splits the city from its region and unescapes underscores", () => {
    expect(describeTimeZone("America/New_York")).toEqual({
      id: "America/New_York",
      city: "New York",
      region: "America",
    });
  });

  it("keeps every intermediate segment in the region", () => {
    expect(describeTimeZone("America/Indiana/Indianapolis")).toEqual({
      id: "America/Indiana/Indianapolis",
      city: "Indianapolis",
      region: "America · Indiana",
    });
  });

  it("leaves single-segment zones without a region", () => {
    expect(describeTimeZone("UTC")).toEqual({
      id: "UTC",
      city: "UTC",
      region: "",
    });
  });
});

describe("normalizeForSearch", () => {
  it("folds case, diacritics, and separators together", () => {
    expect(normalizeForSearch("América/São_Paulo")).toBe("america sao paulo");
  });
});

describe("searchTimeZones", () => {
  it("returns every option for an empty or whitespace query", () => {
    expect(searchTimeZones(OPTIONS, "")).toHaveLength(OPTIONS.length);
    expect(searchTimeZones(OPTIONS, "   ")).toHaveLength(OPTIONS.length);
  });

  it("finds a city buried under an extra path segment", () => {
    expect(ids("indianapolis")).toEqual(["America/Indiana/Indianapolis"]);
  });

  it("finds a city by its underscore-separated second word", () => {
    expect(ids("york")).toEqual(["America/New_York"]);
  });

  it("matches an intermediate region segment", () => {
    expect(ids("indiana")).toEqual(["America/Indiana/Indianapolis"]);
  });

  it("ignores diacritics the user did not type", () => {
    expect(ids("sao paulo")).toEqual(["America/Sao_Paulo"]);
  });

  it("ranks an exact city above a merely-containing one", () => {
    const options = [
      describeTimeZone("America/Belize"),
      describeTimeZone("Europe/Berlin"),
    ];
    expect(searchTimeZones(options, "berlin").map((o) => o.id)).toEqual([
      "Europe/Berlin",
    ]);
  });

  it("ranks a city match ahead of a region-only match", () => {
    // "Berlin" is a city; "Europe/London" only matches via its region.
    const options = [
      describeTimeZone("Europe/London"),
      describeTimeZone("Europe/Berlin"),
    ];
    expect(searchTimeZones(options, "berlin").map((o) => o.id)).toEqual([
      "Europe/Berlin",
    ]);
  });

  it("sorts region-only matches by city", () => {
    // No city contains "america", so every hit lands on the region tier.
    expect(ids("america")).toEqual([
      "America/Argentina/Buenos_Aires",
      "America/Chicago",
      "America/Indiana/Indianapolis",
      "America/New_York",
      "America/Sao_Paulo",
    ]);
  });

  it("returns nothing for a query that matches no zone", () => {
    expect(ids("atlantis")).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const before = [...OPTIONS];
    searchTimeZones(OPTIONS, "tokyo");
    expect(OPTIONS).toEqual(before);
  });
});

describe("buildTimeZoneOptions", () => {
  it("puts the device zone first and never repeats it", () => {
    const options = buildTimeZoneOptions(IDS, "Europe/Berlin");
    expect(options[0]?.id).toBe("Europe/Berlin");
    expect(options.filter((o) => o.id === "Europe/Berlin")).toHaveLength(1);
    expect(options).toHaveLength(IDS.length);
  });

  it("includes a device zone missing from the platform list", () => {
    const options = buildTimeZoneOptions(["UTC"], "Pacific/Auckland");
    expect(options.map((o) => o.id)).toEqual(["Pacific/Auckland", "UTC"]);
  });

  it("sorts the remainder by city, not by identifier", () => {
    const cities = buildTimeZoneOptions(IDS, "UTC")
      .slice(1)
      .map((o) => o.city);
    expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b)));
  });
});

describe("timeZoneLabel", () => {
  it("names the city and what its clock reads, never the tz-db realm", () => {
    // "America" in America/New_York is a tz-database realm, not a country.
    // "New York, America" is not a place, and it read as a bug to anyone
    // checking whether the app had guessed their convention's zone right.
    expect(timeZoneLabel("America/New_York")).toMatch(/^New York · GMT[+-]\d/);
    expect(timeZoneLabel("America/Indiana/Indianapolis")).toMatch(
      /^Indianapolis · GMT[+-]\d/,
    );
  });

  it("drops a bare GMT that would add nothing", () => {
    expect(timeZoneLabel("UTC")).toBe("UTC");
  });

  it("falls back to the city for an id this runtime does not know", () => {
    expect(timeZoneLabel("Mars/Olympus_Mons")).toBe("Olympus Mons");
  });
});
