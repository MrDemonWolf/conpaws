import { describe, expect, it } from "vitest";
import type { Convention } from "@/db/schema";
import {
  conventionDaysUntil,
  conventionStatusAt,
  partitionConventions,
  sortConventions,
} from "./convention-list";

const conventions = [
  {
    id: "past",
    name: "Zeta Con",
    startDate: "2025-01-01",
    endDate: "2025-01-02",
    status: "ended",
  },
  {
    id: "later",
    name: "Alpha Con",
    startDate: "2027-01-01",
    endDate: "2027-01-02",
    status: "upcoming",
  },
  {
    id: "sooner",
    name: "Beta Con",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    status: "active",
  },
  {
    id: "older-past",
    name: "Gamma Con",
    startDate: "2024-01-01",
    endDate: "2024-01-02",
    status: "ended",
  },
].map(
  (convention) =>
    ({
      ...convention,
      timeZone: null,
      icalUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }) as Convention,
);

const compareNames = (left: string, right: string) => left.localeCompare(right);

describe("convention list ordering", () => {
  it("sorts current conventions before past ones without mutating", () => {
    const now = new Date("2025-12-01T12:00:00.000Z");
    expect(
      sortConventions(conventions, "upcoming", compareNames, now, "UTC").map(
        ({ id }) => id,
      ),
    ).toEqual(["sooner", "later", "past", "older-past"]);
    expect(
      sortConventions(conventions, "name", compareNames, now, "UTC").map(
        ({ id }) => id,
      ),
    ).toEqual(["later", "sooner", "older-past", "past"]);
    expect(conventions.map(({ id }) => id)).toEqual([
      "past",
      "later",
      "sooner",
      "older-past",
    ]);
  });

  it("derives status from the convention day across midnight", () => {
    const localConvention = {
      ...conventions[0],
      id: "local",
      startDate: "2026-08-19",
      endDate: "2026-08-19",
      timeZone: "America/Chicago",
      status: "ended",
    } as Convention;
    const nextConvention = {
      ...conventions[1],
      id: "next",
      startDate: "2026-08-20",
      endDate: "2026-08-20",
      timeZone: "America/Chicago",
      status: "ended",
    } as Convention;
    const beforeMidnight = new Date("2026-08-20T04:30:00.000Z");
    const afterMidnight = new Date("2026-08-20T06:30:00.000Z");

    expect(conventionStatusAt(localConvention, beforeMidnight, "UTC")).toBe(
      "active",
    );
    expect(
      sortConventions(
        [localConvention, nextConvention],
        "upcoming",
        compareNames,
        afterMidnight,
        "UTC",
      ).map(({ id }) => id),
    ).toEqual(["next", "local"]);

    expect(conventionDaysUntil(localConvention, beforeMidnight, "UTC")).toBe(0);
    expect(conventionDaysUntil(nextConvention, beforeMidnight, "UTC")).toBe(1);
    expect(conventionDaysUntil(nextConvention, afterMidnight, "UTC")).toBe(0);
    expect(
      conventionDaysUntil(
        {
          ...nextConvention,
          startDate: "2026-03-09",
        },
        new Date("2026-03-07T18:00:00.000Z"),
        "UTC",
      ),
    ).toBe(2);
  });

  it("moves ended conventions into the archive without trusting stored status", () => {
    const staleStatusConventions = conventions.map((convention) =>
      convention.id === "past"
        ? ({ ...convention, status: "upcoming" } as Convention)
        : convention,
    );
    const { current, archived } = partitionConventions(
      staleStatusConventions,
      new Date("2025-12-01T12:00:00.000Z"),
      "UTC",
    );

    expect(current.map(({ id }) => id)).toEqual(["later", "sooner"]);
    expect(archived.map(({ id }) => id)).toEqual(["past", "older-past"]);
  });
});
