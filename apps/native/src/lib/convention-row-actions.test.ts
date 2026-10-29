import { describe, expect, it } from "vitest";
import { conventionRowActions } from "./convention-row-actions";

const labels = {
  edit: "Edit",
  archive: "Archive",
  unarchive: "Unarchive",
  delete: "Delete",
};

describe("convention row actions", () => {
  it.each([
    [false, false, false, ["edit", "archive", "delete"]],
    [true, false, true, ["edit", "unarchive", "delete"]],
    [true, false, false, ["edit", "delete"]],
    [false, true, false, ["edit", "delete"]],
    [true, true, true, ["edit", "delete"]],
  ] as const)(
    "offers only actions that can move the row (archived %s, ended %s, unarchive %s)",
    (archived, ended, canUnarchive, expected) => {
      expect(
        conventionRowActions(
          { archived, ended, canUnarchive, disabled: false },
          labels,
        ).map((action) => action.id),
      ).toEqual(expected);
    },
  );

  it("keeps localized labels and disables every action during a pending write", () => {
    const actions = conventionRowActions(
      { archived: false, ended: false, canUnarchive: false, disabled: true },
      { ...labels, edit: "Bearbeiten" },
    );
    expect(actions[0]?.label).toBe("Bearbeiten");
    expect(actions.every((action) => action.disabled)).toBe(true);
    expect(actions.at(-1)?.id).toBe("delete");
  });
});
