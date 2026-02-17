import { Badge } from "@/components/ui/badge";
import type { ConventionStatus } from "@/types";

interface StatusBadgeProps {
  status: ConventionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={status}>{label}</Badge>;
}
