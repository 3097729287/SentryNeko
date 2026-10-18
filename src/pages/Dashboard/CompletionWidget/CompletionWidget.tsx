/** Completion panel: how much of today's list is done. */

import { useCompletionRate } from "../../../hooks/useCompletionRate";
import { useI18n } from "../../../hooks/useI18n";

/** The share of today's tasks that are finished. */
export function CompletionWidget() {
  const { t } = useI18n();
  const { completion, error, loading } = useCompletionRate("today");

  const percent =
    completion.total === 0 ? 0 : Math.round((completion.completed / completion.total) * 100);

  return (
    <section className="dash-panel">
      <p className="dash-kicker">{t("dashboard.rate.title")}</p>
      {loading ? <p className="dash-muted">{t("dashboard.loading")}</p> : null}
      {error !== null ? <p className="error">{t("dashboard.error")}</p> : null}
      {!loading && error === null ? (
        completion.total === 0 ? (
          <p className="dash-muted">{t("dashboard.rate.empty")}</p>
        ) : (
          <>
            <p className="dash-rate">{t("dashboard.rate.value", { percent })}</p>
            <p className="dash-note">
              {t("dashboard.rate.counts", {
                completed: completion.completed,
                total: completion.total,
              })}
            </p>
            <span aria-hidden="true" className="meter">
              <span style={{ width: `${percent}%` }} />
            </span>
          </>
        )
      ) : null}
    </section>
  );
}
