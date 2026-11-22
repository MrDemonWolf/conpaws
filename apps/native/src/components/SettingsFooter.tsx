import { FieldGroup } from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { NativeText } from "@/components/ui/NativeText";

/**
 * A Settings section's footnote. Call it as a function, never as
 * `<SettingsFooter />`: `@expo/ui` finds a section's footer by its element
 * type and shows only the last one, so the section must get the
 * `FieldGroup.SectionFooter` element itself, once.
 */
export function settingsFooter(text: string) {
  return (
    <FieldGroup.SectionFooter>
      <NativeText modifiers={[font({ textStyle: "footnote" })]}>
        {text}
      </NativeText>
    </FieldGroup.SectionFooter>
  );
}
