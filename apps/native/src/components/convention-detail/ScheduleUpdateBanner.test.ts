import { describe, expect, it, vi } from "vitest";
import type { ScheduleChangeSummary } from "@/lib/schedule-changes";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}(${options.count})`,
  }),
}));
vi.mock("@/components/ui", () => ({ Banner: () => null }));

import { ScheduleUpdateBanner } from "./ScheduleUpdateBanner";

const NOTHING: ScheduleChangeSummary = {
  moved: 0,
  gone: 0,
  savedMoved: 0,
  savedGone: 0,
  nowDropIn: 0,
  savedNowDropIn: 0,
};

/** The title and body the banner would hand to `Banner`, or null. */
function notice(summary: Partial<ScheduleChangeSummary>) {
  const element = ScheduleUpdateBanner({
    summary: { ...NOTHING, ...summary },
    onDismiss: () => {},
  });
  return element
    ? { title: element.props.title as string, body: element.props.body }
    : null;
}

describe("ScheduleUpdateBanner", () => {
  it("says a saved all-day event is now a drop-in, not that it moved", () => {
    expect(notice({ nowDropIn: 1, savedNowDropIn: 1 })).toEqual({
      title: "convention.scheduleUpdate.dropInOne(1)",
      body: "convention.scheduleUpdate.dropInBody",
    });
    expect(notice({ nowDropIn: 3, savedNowDropIn: 2 })).toEqual({
      title: "convention.scheduleUpdate.dropInMany(2)",
      body: "convention.scheduleUpdate.dropInBody",
    });
  });

  it("adds the drop-in note under a panel that really moved", () => {
    expect(
      notice({ moved: 1, savedMoved: 1, nowDropIn: 1, savedNowDropIn: 1 }),
    ).toEqual({
      title: "convention.scheduleUpdate.movedOne(1)",
      body: "convention.scheduleUpdate.body convention.scheduleUpdate.dropInBody",
    });
  });

  it("shows nothing when nothing the user saved changed", () => {
    expect(notice({ moved: 4, gone: 2, nowDropIn: 3 })).toBeNull();
  });
});
