/** Language selection control: every offered language by its own name. */

import { useI18n } from "../hooks/useI18n";
import { isAvailableLanguage } from "../i18n/config";
import { SegmentedControl } from "./ui/SegmentedControl";

/** Lets the user pick one of the offered languages; reserved tags are not listed. */
export function LanguageSwitcher() {
  const { t, language, languages, setLanguage } = useI18n();

  return (
    <SegmentedControl
      label={t("language.label")}
      onChange={(next) => {
        if (isAvailableLanguage(next) && next !== language) {
          void setLanguage(next);
        }
      }}
      options={languages.map((option) => ({
        label: option.nativeName,
        value: option.code,
      }))}
      value={language}
    />
  );
}
