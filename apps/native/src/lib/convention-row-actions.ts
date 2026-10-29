export type ConventionRowActionId = "edit" | "archive" | "unarchive" | "delete";

export interface ConventionRowAction {
  id: ConventionRowActionId;
  label: string;
  disabled: boolean;
}

/** Ended conventions stay in Past; archive actions must actually move a row. */
export function conventionRowActions(
  state: {
    archived: boolean;
    ended: boolean;
    canUnarchive: boolean;
    disabled: boolean;
  },
  labels: Record<ConventionRowActionId, string>,
): ConventionRowAction[] {
  const ids: ConventionRowActionId[] = ["edit"];
  if (!state.ended) {
    if (!state.archived) ids.push("archive");
    else if (state.canUnarchive) ids.push("unarchive");
  }
  ids.push("delete");
  return ids.map((id) => ({ id, label: labels[id], disabled: state.disabled }));
}
