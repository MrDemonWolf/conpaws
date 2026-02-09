import { createContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import type { PremiumState } from "@/types";

const REVENUECAT_API_KEY_APPLE =
  process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? "";
const REVENUECAT_API_KEY_GOOGLE =
  process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? "";

export interface PremiumContextValue {
  premium: PremiumState;
  isLoading: boolean;
  restore: () => Promise<void>;
}

export const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [premium, setPremium] = useState<PremiumState>({
    isActive: false,
    entitlements: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // RevenueCat doesn't support web
      if (Platform.OS === "web") {
        setIsLoading(false);
        return;
      }

      const apiKey =
        Platform.OS === "ios"
          ? REVENUECAT_API_KEY_APPLE
          : REVENUECAT_API_KEY_GOOGLE;

      if (!apiKey) {
        setIsLoading(false);
        return;
      }

      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey });

      try {
        const customerInfo = await Purchases.getCustomerInfo();
        updatePremiumState(customerInfo);
      } catch {
        // RevenueCat not available (e.g. simulator without config)
      }
      setIsLoading(false);
    }

    init();
  }, []);

  function updatePremiumState(customerInfo: CustomerInfo) {
    const pawPass = customerInfo.entitlements.active["paw_pass"];
    setPremium({
      isActive: !!pawPass,
      entitlements: pawPass ? ["paw_pass"] : [],
    });
  }

  async function restore() {
    if (Platform.OS === "web") return;
    try {
      const customerInfo = await Purchases.restorePurchases();
      updatePremiumState(customerInfo);
    } catch {
      // Restore failed
    }
  }

  return (
    <PremiumContext.Provider value={{ premium, isLoading, restore }}>
      {children}
    </PremiumContext.Provider>
  );
}
