/** Usage panel: the applications that took the most time today. */

import { Link } from "react-router-dom";

import { useAppUsage } from "../../../hooks/useAppEvents";
import { useI18n } from "../../../hooks/useI18n";
import { formatSpan } from "../format";

/** How many applications the panel lists. */
const SHOWN_APPS = 3;

/** The top applications of the day, longest first. */
export function UsageWidget() {
  const { t } = useI18n();
  const { error, loading, usage } = useAppUsage("today");

  const peakApp = usage[0]?.seconds ?? 1;

  return (
    <section className="dash-panel">
      <p className="dash-kicker">{t("dashboard.apps.title")}</p>
      {loading ? <p className="dash-muted">{t("dashboard.loading")}</p> : null}
      {error !== null ? <p className="error">{t("dashboard.error")}</p> : null}
      {!loading && error === null ? (
        usage.length === 0 ? (
          <p className="dash-muted">{t("dashboard.apps.empty")}</p>
        ) : (
          <>
            <ul className="dash-apps">
              {usage.slice(0, SHOWN_APPS).map((entry) => (
                <li className="dash-app" key={entry.appName}>
                  <span className="dash-app-name" title={entry.appName}>
                    {entry.appName}
                  </span>
                  <span className="dash-app-time">{formatSpan(entry.seconds, t)}</span>
                  <span aria-hidden="true" className="meter">
                    <span
                      style={{
                        width: `${Math.round((entry.seconds / peakApp) * 100)}%`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <Link className="dash-link" to="/analytics">
              {t("dashboard.apps.open")}
            </Link>
          </>
        )
      ) : null}
    </section>
  );
}
