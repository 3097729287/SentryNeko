/** Pomodoro page. */

import { useI18n } from "../hooks/useI18n";

/** Renders the pomodoro timer page. */
export function PomodoroPage() {
  const { t } = useI18n();

  return (
    <>
      <h1>{t("nav.pomodoro")}</h1>
      <div className="empty">
        <p>{t("pages.empty")}</p>
      </div>
    </>
  );
}
