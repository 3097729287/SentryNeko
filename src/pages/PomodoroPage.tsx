/** Pomodoro page. */

import { useEffect } from "react";

import { PomodoroSettings } from "../components/PomodoroSettings";
import { PomodoroTimer } from "../components/PomodoroTimer";
import { useI18n } from "../hooks/useI18n";
import { usePomodoro } from "../hooks/usePomodoro";

/** Renders the countdown and the duration settings behind it. */
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
      <PomodoroSettings />
    </>
  );
}
