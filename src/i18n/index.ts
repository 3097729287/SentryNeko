/** i18next / react-i18next initialization. */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from "./config";
import enUS from "./locales/en-US.json";
import jaJP from "./locales/ja-JP.json";
import zhCN from "./locales/zh-CN.json";

/**
 * Locale files keyed by tag. `ja-JP` is loaded but not selectable: `config.ts` decides
 * which tags i18next may resolve to.
 */
const resources = {
  "en-US": { translation: enUS },
  "zh-CN": { translation: zhCN },
  "ja-JP": { translation: jaJP },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: AVAILABLE_LANGUAGES.map((language) => language.code),
  interpolation: {
    // React already escapes the values it renders.
    escapeValue: false,
  },
});

export default i18n;
