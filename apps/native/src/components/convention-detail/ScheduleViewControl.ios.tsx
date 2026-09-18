import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { frame, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";

type ScheduleView = "all" | "mine" | "interested" | "now-next";
type PrimaryView = "schedule" | "plan" | "now";

interface ScheduleViewControlProps {
  labels: {
    schedule: string;
    plan: string;
    now: string;
    going: string;
    interested: string;
  };
  value: ScheduleView;
  onChange: (value: ScheduleView) => void;
}

export function ScheduleViewControl({
  labels,
  value,
  onChange,
}: ScheduleViewControlProps) {
  const colorScheme = useResolvedColorScheme();
  const primary: PrimaryView =
    value === "all" ? "schedule" : value === "now-next" ? "now" : "plan";
  const hostProps = {
    colorScheme,
    seedColor: themeTokens[colorScheme].primary,
    matchContents: { vertical: true as const },
    style: { alignSelf: "stretch" as const },
  };

  return (
    <View className="gap-2 border-b border-border bg-background px-4 py-2">
      <Host {...hostProps}>
        <Picker<PrimaryView>
          selection={primary}
          onSelectionChange={(selection) => {
            onChange(
              selection === "schedule"
                ? "all"
                : selection === "now"
                  ? "now-next"
                  : value === "interested"
                    ? "interested"
                    : "mine",
            );
          }}
          modifiers={[
            pickerStyle("segmented"),
            frame({ maxWidth: Infinity, minHeight: 44 }),
          ]}
        >
          <Text modifiers={[tag("schedule")]}>{labels.schedule}</Text>
          <Text modifiers={[tag("plan")]}>{labels.plan}</Text>
          <Text modifiers={[tag("now")]}>{labels.now}</Text>
        </Picker>
      </Host>
      {primary === "plan" ? (
        <Host {...hostProps}>
          <Picker<"mine" | "interested">
            selection={value === "interested" ? "interested" : "mine"}
            onSelectionChange={onChange}
            modifiers={[
              pickerStyle("segmented"),
              frame({ maxWidth: Infinity, minHeight: 44 }),
            ]}
          >
            <Text modifiers={[tag("mine")]}>{labels.going}</Text>
            <Text modifiers={[tag("interested")]}>{labels.interested}</Text>
          </Picker>
        </Host>
      ) : null}
    </View>
  );
}
