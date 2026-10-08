import { ScrollView } from "react-native";
import { Chip } from "@/components/ui/Chip";

export interface TimeChipSlot {
  startMs: number;
  label: string;
  accessibilityLabel: string;
}

interface TimeChipRowProps {
  slots: readonly TimeChipSlot[];
  /** Start of the selected hour, or null for all times. */
  selectedStartMs: number | null;
  allTimesLabel: string;
  onSelect: (startMs: number | null) => void;
}

/** The hour chips on the Browse view: "All times", then every hour with a start. */
export function TimeChipRow({
  slots,
  selectedStartMs,
  allTimesLabel,
  onSelect,
}: TimeChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      <Chip
        label={allTimesLabel}
        selected={selectedStartMs === null}
        onPress={() => onSelect(null)}
      />
      {slots.map((slot) => (
        <Chip
          key={slot.startMs}
          label={slot.label}
          accessibilityLabel={slot.accessibilityLabel}
          selected={selectedStartMs === slot.startMs}
          onPress={() => onSelect(slot.startMs)}
        />
      ))}
    </ScrollView>
  );
}
