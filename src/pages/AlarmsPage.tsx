/** Alarms page. */

import { useI18n } from "../hooks/useI18n";

/** Renders the alarm list page. */
export function AlarmsPage() {
  const { t } = useI18n();

  return (
    <>
      <h1>{t("nav.alarms")}</h1>
      <div className="empty">
        <p>{t("pages.empty")}</p>
      </div>
    </>
  );
}
