/** Language switching hook: current locale plus persistence to the backend config. */

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { useI18nStore } from "../stores/i18nStore";
import type { LanguageCode, LanguageOption } from "../types/i18n";

export interface UseI18nResult {
  /** Translator bound to the active language. */
  t: TFunction;
  language: LanguageCode;
  /** Tags the switcher offers, in display order. */
  languages: readonly LanguageOption[];
  setLanguage: (language: LanguageCode) => Promise<void>;
}

/** Copy and language switching for a component. */
export function useI18n(): UseI18nResult {
  const { t } = useTranslation();
  const language = useI18nStore((state) => state.language);
  const languages = useI18nStore((state) => state.languages);
  const setLanguage = useI18nStore((state) => state.setLanguage);

  return { t, language, languages, setLanguage };
}
