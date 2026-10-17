/** Language selection control. */

import { useI18n } from "../hooks/useI18n";
import { isAvailableLanguage } from "../i18n/config";

/** Lets the user pick one of the offered languages; reserved tags are not listed. */
export function LanguageSwitcher() {
  const { t, language, languages, setLanguage } = useI18n();

  return (
    <label>
      <span>{t("language.label")}</span>
      <select
        value={language}
        onChange={(event) => {
          const next = event.target.value;

          if (isAvailableLanguage(next)) {
            void setLanguage(next);
          }
        }}
      >
        {languages.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
