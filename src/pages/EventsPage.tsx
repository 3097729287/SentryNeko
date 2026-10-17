/** Foreground application event stream page. */

import { useState } from "react";

import { AppEventLog } from "../components/AppEventLog";
import { useI18n } from "../hooks/useI18n";
import { BACKEND_EVENTS, emitTestEvent, useTauriEvent } from "../hooks/useTauriEvent";
import { useAppEventStore } from "../stores/appEventStore";
import type { TestEventPayload } from "../types";
import type { PomodoroPhase, PomodoroSession } from "../types/pomodoro";

/**
 * Renders the event stream page. Two pushes are live here — the collector's `app-switch` and the
 * timer's `pomodoro-finished` — and the bus probe asks the backend for one `test-event`, which is
 * what proves the path from `services/event_bus.rs` to the window.
 */
export function EventsPage() {
  const { t } = useI18n();
  const live = useAppEventStore((state) => state.live);
  const [sequence, setSequence] = useState<number | null>(null);
  const [finished, setFinished] = useState<PomodoroPhase | null>(null);

  useTauriEvent<TestEventPayload>(BACKEND_EVENTS.testEvent, (payload) => {
    setSequence(payload.sequence);
  });

  useTauriEvent<PomodoroSession>(BACKEND_EVENTS.pomodoroFinished, (payload) => {
    setFinished(payload.phase);
  });

  return (
    <>
      <h1>{t("nav.events")}</h1>
      <div className="card">
        <h2>{t("events.log.title")}</h2>
        <AppEventLog events={live} />
      </div>
      <div className="card">
        <p className="muted">
          {finished === null
            ? t("events.pomodoro.none")
            : t("events.pomodoro.finished", { phase: t(`pomodoro.phase.${finished}`) })}
        </p>
      </div>
      <div className="card">
        <button
          className="btn"
          type="button"
          onClick={() => {
            void emitTestEvent();
          }}
        >
          {t("events.test.send")}
        </button>
        <p className="muted">
          {sequence === null
            ? t("events.test.waiting")
            : t("events.test.received", { sequence })}
        </p>
      </div>
    </>
  );
}
