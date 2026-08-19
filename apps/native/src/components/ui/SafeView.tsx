import { styled } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

const StyledSafeAreaView = styled(SafeAreaView);

interface SafeViewProps {
  children: React.ReactNode;
  edges?: Array<"top" | "right" | "bottom" | "left">;
  className?: string;
}

export function SafeView({
  children,
  edges = ["top", "bottom"],
  className,
}: SafeViewProps) {
  return (
    <StyledSafeAreaView
      edges={edges}
      className={cn("flex-1 bg-background", className)}
    >
      {children}
    </StyledSafeAreaView>
  );
}
