/** In-app banner for an alarm going off; the system toast is only one of the two channels. */

import { useEffect, useRef, useState } from "react";

import { useI18n } from "../hooks/useI18n";
import { BACKEND_EVENTS, useTauriEvent } from "../hooks/useTauriEvent";
import { clockTime } from "../types/alarm";
import type { Alarm } from "../types/alarm";

/** How long the banner stays when nobody dismisses it. */
const RING_LIFETIME_MS = 60_000;

/** Subscribes to the trigger pushes and keeps the newest alarm on screen until dismissed. */
export function AlarmRinging() {
  const { t } = useI18n();
  const [ringing, setRinging] = useState<Alarm | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useTauriEvent<Alarm>(BACKEND_EVENTS.alarmTriggered, (alarm) => {
    setRinging(alarm);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setRinging(null);
    }, RING_LIFETIME_MS);
  });

  // The timer outlives the banner it removes, so it is cleared when the host goes away.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  if (ringing === null) {
    return null;
  }

  return (
    <div className="alarm-ringing" role="alert">
      <span className="alarm-ringing-clock">{clockTime(ringing.hour, ringing.minute)}</span>
      <span className="alarm-ringing-body">
        <strong>{t("alarm.ringing.title")}</strong>
        <span>{ringing.label === "" ? t("alarm.untitled") : ringing.label}</span>
      </span>
      <button
        className="btn"
        onClick={() => {
          setRinging(null);
        }}
        type="button"
      >
        {t("alarm.ringing.dismiss")}
      </button>
    </div>
  );
}
