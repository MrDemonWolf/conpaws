import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ColorScheme = "light" | "dark" | "system";

interface ColorSchemeContextValue {
  colorScheme: "light" | "dark";
  preference: ColorScheme;
  setPreference: (scheme: ColorScheme) => void;
  isDark: boolean;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue>({
  colorScheme: "light",
  preference: "system",
  setPreference: () => {},
  isDark: false,
});

const STORAGE_KEY = "color-scheme-preference";

export function ColorSchemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemScheme = useRNColorScheme() ?? "light";
  const [preference, setPreferenceState] = useState<ColorScheme>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === "light" || value === "dark" || value === "system") {
        setPreferenceState(value);
      }
      setIsLoaded(true);
    });
  }, []);

  const setPreference = useCallback((scheme: ColorScheme) => {
    setPreferenceState(scheme);
    AsyncStorage.setItem(STORAGE_KEY, scheme);
  }, []);

  const colorScheme = preference === "system" ? systemScheme : preference;

  if (!isLoaded) return null;

  return (
    <ColorSchemeContext.Provider
      value={{
        colorScheme,
        preference,
        setPreference,
        isDark: colorScheme === "dark",
      }}
    >
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  return useContext(ColorSchemeContext);
}
