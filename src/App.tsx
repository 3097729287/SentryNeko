import { useState } from "react";

import { I18nProvider } from "./components/I18nProvider";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useI18n } from "./hooks/useI18n";
import { BACKEND_EVENTS, emitTestEvent, useTauriEvent } from "./hooks/useTauriEvent";
import type { TestEventPayload } from "./types";

/** Shows that a backend event reaches the UI; T09 replaces it with the real pages. */
function EventBusProbe() {
  const { t } = useI18n();
  const [sequence, setSequence] = useState<number | null>(null);

  useTauriEvent<TestEventPayload>(BACKEND_EVENTS.testEvent, (payload) => {
    setSequence(payload.sequence);
  });

  return (
    <p>
      <button
        type="button"
        onClick={() => {
          void emitTestEvent();
        }}
      >
        {t("events.test.send")}
      </button>{" "}
      {sequence === null
        ? t("events.test.waiting")
        : t("events.test.received", { sequence })}
    </p>
  );
}

/** Placeholder shell: routing and page layout arrive with T09. */
function Shell() {
  const { t } = useI18n();

  return (
    <main>
      <h1>{t("app.name")}</h1>
      <p>{t("app.tagline")}</p>
      <LanguageSwitcher />
      <EventBusProbe />
    </main>
  );
}

/** Root component. */
export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
