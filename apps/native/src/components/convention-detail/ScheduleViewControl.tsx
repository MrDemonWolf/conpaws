import { Pressable, View } from "react-native";
import { Text } from "@/components/ui";

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
  const primary: PrimaryView =
    value === "all" ? "schedule" : value === "now-next" ? "now" : "plan";
  const primaryOptions = [
    ["schedule", labels.schedule],
    ["plan", labels.plan],
    ["now", labels.now],
  ] as const;
  const planOptions = [
    ["mine", labels.going],
    ["interested", labels.interested],
  ] as const;

  return (
    <View className="gap-2 border-b border-border bg-background px-4 py-2">
      <View className="flex-row rounded-xl bg-muted p-1">
        {primaryOptions.map(([option, label]) => (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: primary === option }}
            className={`min-h-11 flex-1 items-center justify-center rounded-lg px-2 ${primary === option ? "bg-card" : ""}`}
            onPress={() =>
              onChange(
                option === "schedule"
                  ? "all"
                  : option === "now"
                    ? "now-next"
                    : value === "interested"
                      ? "interested"
                      : "mine",
              )
            }
          >
            <Text variant="label">{label}</Text>
          </Pressable>
        ))}
      </View>
      {primary === "plan" ? (
        <View className="flex-row rounded-xl bg-muted p-1">
          {planOptions.map(([option, label]) => (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: value === option }}
              className={`min-h-11 flex-1 items-center justify-center rounded-lg px-2 ${value === option ? "bg-card" : ""}`}
              onPress={() => onChange(option)}
            >
              <Text variant="label">{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
