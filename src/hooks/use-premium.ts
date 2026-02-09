import { useContext } from "react";
import { PremiumContext } from "@/contexts/premium-context";

export function usePremium() {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error("usePremium must be used within a PremiumProvider");
  }
  return context;
}
