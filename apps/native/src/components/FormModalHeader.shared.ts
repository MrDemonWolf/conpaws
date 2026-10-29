/**
 * Android's full-screen form modals need a top inset for their in-content
 * header. The iOS form sheet supplies that inset through its native toolbar.
 */
export const FORM_SAFE_EDGES: Array<"top" | "right" | "bottom" | "left"> =
  process.env.EXPO_OS === "ios" ? ["bottom"] : ["top", "bottom"];
