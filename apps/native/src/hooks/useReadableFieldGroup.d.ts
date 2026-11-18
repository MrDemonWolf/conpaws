import type { FieldGroupProps } from "@expo/ui";

/** Props to spread onto a full-window `<FieldGroup>`. */
export type ReadableFieldGroupProps = Pick<FieldGroupProps, "style" | "modifiers">;

/**
 * Lays a settings-style `FieldGroup` into the readable column on a wide
 * window, and returns `{}` everywhere else, so phones keep their forms
 * exactly. TypeScript resolves this extension-free import; Metro picks the
 * real `.ios.ts` or `.android.ts` implementation at runtime.
 *
 * The column is window-based, so it is only right when the form fills the
 * window. Pass `inSheet` for a screen presented as a form sheet on this
 * platform: there the sheet, not the window, sets the width.
 */
export declare function useReadableFieldGroup(options?: {
  inSheet?: boolean;
}): ReadableFieldGroupProps;
