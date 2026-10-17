/** Settings page: Pomodoro defaults, alarm defaults, language and data management. */

import { useI18n } from "../hooks/useI18n";

/** Renders the settings page. */
export function SettingsPage() {
  const { t } = useI18n();

  return <h1>{t("nav.settings")}</h1>;
}
