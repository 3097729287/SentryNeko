/** Language configuration: supported locales, default locale, fallback rules. */

import type { LanguageCode, LanguageOption } from "../types/i18n";

/** Used when nothing else is stored; mirrors `Language::DEFAULT` in `services/i18n.rs`. */
export const DEFAULT_LANGUAGE: LanguageCode = "en-US";

/** Every tag `src/i18n/locales/` holds a file for, reserved ones included. */
export const LANGUAGES: readonly LanguageOption[] = [
  { code: "en-US", nativeName: "English", available: true },
  { code: "zh-CN", nativeName: "简体中文", available: true },
  { code: "ja-JP", nativeName: "日本語", available: false },
];

/** Tags the switcher offers and i18next is allowed to resolve to. */
export const AVAILABLE_LANGUAGES: readonly LanguageOption[] = LANGUAGES.filter(
  (language) => language.available,
);

/** Whether the tag has complete copy and may be selected. */
export function isAvailableLanguage(value: unknown): value is LanguageCode {
  return AVAILABLE_LANGUAGES.some((language) => language.code === value);
}
