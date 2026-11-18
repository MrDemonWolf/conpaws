/**
 * Whether the edit and import forms are presented as a form sheet. iOS gets a
 * detented sheet; Android gets a full-screen modal, because a sheet there
 * re-lays-out when the keyboard opens and clipped the form's header row down
 * to unreadable slivers of Cancel and Save.
 */
export const FORM_PRESENTED_AS_SHEET = process.env.EXPO_OS === "ios";

/**
 * Android's full-screen form modals need a top inset for their in-content
 * header. The iOS form sheet supplies that inset through its native toolbar.
 */
export const FORM_SAFE_EDGES: Array<"top" | "right" | "bottom" | "left"> =
  process.env.EXPO_OS === "ios" ? ["bottom"] : ["top", "bottom"];
