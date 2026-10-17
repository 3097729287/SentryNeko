/** Custom phase lengths, edited in minutes and stored as soon as they settle. */

import { useEffect, useState } from "react";

import { useI18n } from "../hooks/useI18n";
import { usePomodoro } from "../hooks/usePomodoro";
import type { PomodoroDurations } from "../types/pomodoro";

/** Wait after the last keystroke, so typing `25` writes once. */
const SAVE_DELAY_MS = 600;

/** How long the "saved" note stays after a write. */
const SAVED_NOTE_MS = 2_000;

interface Draft {
  focus: string;
  shortBreak: string;
  longBreak: string;
}

/** Three minute fields and the ratio they add up to; every change saves itself. */
export function PomodoroSettings() {
  const { t } = useI18n();
  const { durations, endsAt, error, saveDurations, sessionId } = usePomodoro();
  const [draft, setDraft] = useState<Draft>(() => toDraft(durations));
  const [saved, setSaved] = useState(false);

  // The stored values land after the first render; every save answers with the stored row too.
  useEffect(() => {
    setDraft(toDraft(durations));
  }, [durations]);

  useEffect(() => {
    if (!saved) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSaved(false);
    }, SAVED_NOTE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [saved]);

  const idle = endsAt === null && sessionId === null;
  const next: PomodoroDurations = {
    focusSeconds: toSeconds(draft.focus),
    longBreakSeconds: toSeconds(draft.longBreak),
    shortBreakSeconds: toSeconds(draft.shortBreak),
  };
  const valid =
    minutes(draft.focus) > 0 && minutes(draft.shortBreak) > 0 && minutes(draft.longBreak) > 0;
  const stored =
    next.focusSeconds === durations.focusSeconds &&
    next.longBreakSeconds === durations.longBreakSeconds &&
    next.shortBreakSeconds === durations.shortBreakSeconds;

  const save = (): void => {
    if (!idle || !valid || stored) {
      return;
    }

    void saveDurations(next).then(setSaved);
  };

  useEffect(() => {
    if (!idle || !valid || stored) {
      return;
    }

    const timer = window.setTimeout(save, SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
    // The three fields are the inputs the save reads.
  }, [draft.focus, draft.shortBreak, draft.longBreak, idle, valid, stored, saveDurations]);

  const phases = [
    { key: "focus", value: minutes(draft.focus) },
    { key: "shortBreak", value: minutes(draft.shortBreak) },
    { key: "longBreak", value: minutes(draft.longBreak) },
  ] as const;
  const total = phases.reduce((sum, phase) => sum + phase.value, 0);

  const update = (key: keyof Draft) => (value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="settings-form">
      <div className="phase-grid">
        <label className="set-field">
          <span>{t("pomodoro.settings.focus")}</span>
          <input
            disabled={!idle}
            max={240}
            min={1}
            onBlur={save}
            onChange={(event) => {
              update("focus")(event.target.value);
            }}
            type="number"
            value={draft.focus}
          />
        </label>
        <label className="set-field">
          <span>{t("pomodoro.settings.shortBreak")}</span>
          <input
            disabled={!idle}
            max={240}
            min={1}
            onBlur={save}
            onChange={(event) => {
              update("shortBreak")(event.target.value);
            }}
            type="number"
            value={draft.shortBreak}
          />
        </label>
        <label className="set-field">
          <span>{t("pomodoro.settings.longBreak")}</span>
          <input
            disabled={!idle}
            max={240}
            min={1}
            onBlur={save}
            onChange={(event) => {
              update("longBreak")(event.target.value);
            }}
            type="number"
            value={draft.longBreak}
          />
        </label>
      </div>
      {total > 0 ? (
        <div aria-hidden="true" className="phase-bar">
          {phases.map((phase) => (
            <span
              className="phase-slice"
              data-phase={phase.key}
              key={phase.key}
              style={{ flexGrow: phase.value }}
            />
          ))}
        </div>
      ) : null}
      <p className="phase-keys">
        {phases.map((phase) => {
          const name = t(`pomodoro.phase.${phase.key}`);

          return (
            <span
              className="phase-key"
              data-phase={phase.key}
              key={phase.key}
              title={t("pomodoro.settings.slice", { minutes: phase.value, phase: name })}
            >
              <span aria-hidden="true" className="phase-dot" />
              {name}
            </span>
          );
        })}
      </p>
      {!idle || error !== null || saved ? (
        <p className="settings-status">
          {!idle ? <span className="muted">{t("pomodoro.settings.locked")}</span> : null}
          {idle && error !== null ? (
            <span className="todo-error">{t("pomodoro.settings.error")}</span>
          ) : null}
          {idle && error === null && saved ? (
            <span className="muted">{t("pomodoro.settings.saved")}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function toDraft(durations: PomodoroDurations): Draft {
  return {
    focus: String(Math.round(durations.focusSeconds / 60)),
    longBreak: String(Math.round(durations.longBreakSeconds / 60)),
    shortBreak: String(Math.round(durations.shortBreakSeconds / 60)),
  };
}

/** The minutes behind a field, so the ratio bar ignores a blank or malformed one. */
function minutes(value: string): number {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/** A blank or malformed field becomes zero, which the local validity check already refuses. */
function toSeconds(value: string): number {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? 0 : parsed * 60;
}
