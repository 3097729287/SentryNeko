/** Settings page: the pomodoro durations, the alarm defaults and the language choice. */

import { useEffect } from "react";

import { AlarmDefaultsSettings } from "../components/AlarmDefaultsSettings";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PomodoroSettings } from "../components/PomodoroSettings";
import { useI18n } from "../hooks/useI18n";
import { usePomodoro } from "../hooks/usePomodoro";

/** Renders the settings the app persists. */
export function SettingsPage() {
  const { t } = useI18n();
  const { load } = usePomodoro();

  // Read here as well, so the form shows the stored values without opening the timer first.
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1>{t("nav.settings")}</h1>
      <section className="settings-section">
        <PomodoroSettings />
      </section>
      <section className="settings-section">
        <AlarmDefaultsSettings />
      </section>
      <section className="settings-section">
        <h2>{t("language.label")}</h2>
        <LanguageSwitcher />
      </section>
    </>
  );
}
