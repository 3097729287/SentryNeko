/** Pomodoro page. */

import { useEffect } from "react";

import { PomodoroTimer } from "../components/PomodoroTimer";
import { useI18n } from "../hooks/useI18n";
import { usePomodoro } from "../hooks/usePomodoro";

/** Renders the countdown; its durations are edited on the settings page. */
export function PomodoroPage() {
  const { t } = useI18n();
  const { load } = usePomodoro();

  // One load per mount; the timer below only reads the result and advances the clock.
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1>{t("nav.pomodoro")}</h1>
      <PomodoroTimer />
    </>
  );
}
