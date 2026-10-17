/** Ring duration and notification method, saved as they change and inherited by every alarm. */

import { useEffect, useState } from "react";

import { useAlarmDefaults } from "../hooks/useAlarmDefaults";
import { useI18n } from "../hooks/useI18n";
import { METHOD_LABELS, NOTIFICATION_METHODS } from "../types/alarm";
import type { NotificationMethod } from "../types/alarm";
import { SegmentedControl } from "./ui/SegmentedControl";

/** Wait after the last keystroke, so typing `10` writes once. */
const SAVE_DELAY_MS = 600;

/** How long the "saved" note stays after a write. */
const SAVED_NOTE_MS = 2_000;

/** One duration field and the method switch; both write straight through. */
export function AlarmDefaultsSettings() {
  const { t } = useI18n();
  const { defaults, error, loading, save } = useAlarmDefaults();
  const [seconds, setSeconds] = useState(String(defaults.ringSeconds));
  const [method, setMethod] = useState<NotificationMethod>(defaults.method);
  const [saved, setSaved] = useState(false);

  // The stored values land after the first render; every save answers with the stored row too.
  useEffect(() => {
    setSeconds(String(defaults.ringSeconds));
    setMethod(defaults.method);
  }, [defaults]);

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

  const parsed = Number.parseInt(seconds, 10);
  const valid = !Number.isNaN(parsed) && parsed >= 1;
  const stored = parsed === defaults.ringSeconds && method === defaults.method;

  const write = (): void => {
    if (loading || !valid || stored) {
      return;
    }

    void save({ method, ringSeconds: parsed }).then((result) => {
      setSaved(result !== null);
    });
  };

  useEffect(() => {
    if (loading || !valid || stored) {
      return;
    }

    const timer = window.setTimeout(write, SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [seconds, method, loading, valid, stored, save]);

  return (
    <div className="settings-form">
      <div className="settings-pair">
        <label className="set-field">
          <span>{t("alarm.settings.ring")}</span>
          <input
            disabled={loading}
            max={60}
            min={1}
            onBlur={write}
            onChange={(event) => {
              setSaved(false);
              setSeconds(event.target.value);
            }}
            type="number"
            value={seconds}
          />
        </label>
        <div className="set-field">
          <span>{t("alarm.settings.method")}</span>
          <SegmentedControl
            label={t("alarm.settings.method")}
            onChange={(value) => {
              setSaved(false);
              setMethod(value);
            }}
            options={NOTIFICATION_METHODS.map((value) => ({
              label: t(METHOD_LABELS[value]),
              value,
            }))}
            value={method}
          />
        </div>
      </div>
      {error !== null || saved ? (
        <p className="settings-status">
          {error !== null ? (
            <span className="todo-error">{t("alarm.settings.error")}</span>
          ) : null}
          {error === null && saved ? (
            <span className="muted">{t("alarm.settings.saved")}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
