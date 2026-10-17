/** Analytics page: app usage ranking, focus trends and task completion rate. */

import { useI18n } from "../hooks/useI18n";

/** Renders the analytics page. */
export function AnalyticsPage() {
  const { t } = useI18n();

  return (
    <>
      <h1>{t("nav.analytics")}</h1>
      <div className="empty">
        <p>{t("pages.empty")}</p>
      </div>
    </>
  );
}
