/** Custom phase lengths, edited in minutes and stored in seconds. */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useI18n } from "../hooks/useI18n";
import { usePomodoro } from "../hooks/usePomodoro";
import type { PomodoroDurations } from "../types/pomodoro";

interface Draft {
  focus: string;
  shortBreak: string;
  longBreak: string;
}

/** Three minute fields and the save button that stores them. */
export function PomodoroSettings() {
  const { t } = useI18n();
  const { durations, endsAt, saveDurations, sessionId } = usePomodoro();
  const [draft, setDraft] = useState<Draft>(() => toDraft(durations));
  const [saved, setSaved] = useState(false);

  // The stored values land after the first render, and every save answers with the stored row.
  useEffect(() => {
    setDraft(toDraft(durations));
  }, [durations]);

  const idle = endsAt === null && sessionId === null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);

    void saveDurations({
      focusSeconds: toSeconds(draft.focus),
      longBreakSeconds: toSeconds(draft.longBreak),
      shortBreakSeconds: toSeconds(draft.shortBreak),
    }).then((stored) => {
      setSaved(stored);
    });
  };

  const update = (key: keyof Draft) => (value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <form className="pomodoro-settings" onSubmit={submit}>
      <h2>{t("pomodoro.settings.title")}</h2>
      <label className="pomodoro-field">
        <span>{t("pomodoro.settings.focus")}</span>
        <input
          max={240}
          min={1}
          onChange={(event) => {
            update("focus")(event.target.value);
          }}
          type="number"
          value={draft.focus}
        />
      </label>
      <label className="pomodoro-field">
        <span>{t("pomodoro.settings.shortBreak")}</span>
        <input
          max={240}
          min={1}
          onChange={(event) => {
            update("shortBreak")(event.target.value);
          }}
          type="number"
          value={draft.shortBreak}
        />
      </label>
      <label className="pomodoro-field">
        <span>{t("pomodoro.settings.longBreak")}</span>
        <input
          max={240}
          min={1}
          onChange={(event) => {
            update("longBreak")(event.target.value);
          }}
          type="number"
          value={draft.longBreak}
        />
      </label>
      <div className="pomodoro-settings-actions">
        <button className="btn" disabled={!idle} type="submit">
          {t("pomodoro.settings.save")}
        </button>
        {saved && <span className="muted">{t("pomodoro.settings.saved")}</span>}
        {!idle && <span className="muted">{t("pomodoro.settings.locked")}</span>}
      </div>
    </form>
  );
}

function toDraft(durations: PomodoroDurations): Draft {
  return {
    focus: String(Math.round(durations.focusSeconds / 60)),
    longBreak: String(Math.round(durations.longBreakSeconds / 60)),
    shortBreak: String(Math.round(durations.shortBreakSeconds / 60)),
  };
}

/** A blank or malformed field becomes zero, which the backend refuses with `INVALID_INPUT`. */
function toSeconds(minutes: string): number {
  const value = Number.parseInt(minutes, 10);

  return Number.isNaN(value) ? 0 : value * 60;
}
