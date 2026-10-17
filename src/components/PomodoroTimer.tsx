/** The countdown itself: phase, remaining time and start / pause / reset. */

import { useI18n } from "../hooks/useI18n";
import { usePomodoro } from "../hooks/usePomodoro";
import { POMODORO_PHASES, phaseSeconds } from "../types/pomodoro";
import { SegmentedControl } from "./ui/SegmentedControl";

/** Renders the clock; the store runs the timer, so leaving this page does not stop it. */
export function PomodoroTimer() {
  const { t } = useI18n();
  const { durations, endsAt, error, pause, phase, remainingMs, reset, selectPhase, start } =
    usePomodoro();

  const running = endsAt !== null;
  const totalMs = Math.max(1, phaseSeconds(durations, phase) * 1000);
  const ratio = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <section className="pomodoro-panel">
      <SegmentedControl
        label={t("pomodoro.phase.label")}
        onChange={(next) => {
          void selectPhase(next);
        }}
        options={POMODORO_PHASES.map((value) => ({
          label: t(`pomodoro.phase.${value}`),
          value,
        }))}
        value={phase}
      />
      <p className="pomodoro-clock" role="timer">
        {formatClock(seconds)}
      </p>
      <div aria-hidden="true" className="pomodoro-progress">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="pomodoro-actions">
        <button
          className="btn pomodoro-primary"
          onClick={() => {
            if (running) {
              pause();
            } else {
              void start();
            }
          }}
          type="button"
        >
          {running ? t("pomodoro.pause") : t("pomodoro.start")}
        </button>
        <button
          className="btn"
          onClick={() => {
            void reset();
          }}
          type="button"
        >
          {t("pomodoro.reset")}
        </button>
      </div>
      {error !== null && <p className="todo-error">{t("pomodoro.error")}</p>}
    </section>
  );
}

/** `mm:ss`; the minutes are not capped, so a long custom phase still reads correctly. */
function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
