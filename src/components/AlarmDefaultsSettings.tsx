/** Ring duration and notification method, edited once and inherited by every alarm. */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useAlarmDefaults } from "../hooks/useAlarmDefaults";
import { useI18n } from "../hooks/useI18n";
import { METHOD_LABELS, NOTIFICATION_METHODS } from "../types/alarm";
import type { NotificationMethod } from "../types/alarm";
import { SegmentedControl } from "./ui/SegmentedControl";

/** One duration field, the method switch and the save button. */
export function AlarmDefaultsSettings() {
  const { t } = useI18n();
  const { defaults, error, save } = useAlarmDefaults();
  const [seconds, setSeconds] = useState(String(defaults.ringSeconds));
  const [method, setMethod] = useState<NotificationMethod>(defaults.method);
  const [saved, setSaved] = useState(false);

  // The stored values land after the first render, and every save answers with the stored ones.
  useEffect(() => {
    setSeconds(String(defaults.ringSeconds));
    setMethod(defaults.method);
  }, [defaults]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);

    const parsed = Number.parseInt(seconds, 10);

    void save({
      // A blank or malformed field becomes zero, which the backend refuses with `INVALID_INPUT`.
      ringSeconds: Number.isNaN(parsed) ? 0 : parsed,
      method,
    }).then((stored) => {
      setSaved(stored !== null);
    });
  };

  return (
    <form className="alarm-defaults" onSubmit={submit}>
      <h2>{t("alarm.settings.title")}</h2>
      <label className="alarm-defaults-field">
        <span>{t("alarm.settings.ring")}</span>
        <input
          max={60}
          min={1}
          onChange={(event) => {
            setSaved(false);
            setSeconds(event.target.value);
          }}
          type="number"
          value={seconds}
        />
      </label>
      <div className="alarm-defaults-field">
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
      <div className="alarm-form-actions">
        <button className="btn" type="submit">
          {t("alarm.save")}
        </button>
        {saved ? <span className="muted">{t("alarm.settings.saved")}</span> : null}
        {error !== null ? <span className="todo-error">{t("alarm.settings.error")}</span> : null}
      </div>
    </form>
  );
}
