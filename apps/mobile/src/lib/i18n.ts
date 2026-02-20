import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import en from "@/locales/en.json";

const deviceLanguage = getLocales()[0]?.languageCode ?? "en";

// eslint-disable-next-line import/no-named-as-default-member
i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: deviceLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
