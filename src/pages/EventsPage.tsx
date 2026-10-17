/** Foreground application event stream page. */

import { useState } from "react";

import { useI18n } from "../hooks/useI18n";
import { BACKEND_EVENTS, emitTestEvent, useTauriEvent } from "../hooks/useTauriEvent";
import type { TestEventPayload } from "../types";

/**
 * Renders the event stream page. The bus probe is its only content for now: it asks the
 * backend for one `test-event` and shows the sequence that comes back, which is what proves
 * the push path from `services/event_bus.rs` to the window.
 */
export function EventsPage() {
  const { t } = useI18n();
  const [sequence, setSequence] = useState<number | null>(null);

  useTauriEvent<TestEventPayload>(BACKEND_EVENTS.testEvent, (payload) => {
    setSequence(payload.sequence);
  });

  return (
    <>
      <h1>{t("nav.events")}</h1>
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
