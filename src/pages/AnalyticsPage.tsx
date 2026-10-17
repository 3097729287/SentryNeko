/** Analytics page: app usage ranking, focus trends and task completion rate. */

import { useState } from "react";

import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useAppUsage } from "../hooks/useAppEvents";
import { useI18n } from "../hooks/useI18n";
import { USAGE_RANGES } from "../types/appEvent";
import type { UsageRange } from "../types/appEvent";

/**
 * Renders the analytics page.
 *
 * The foreground ranking is the first block: it switches between today, the last seven days and
 * the last thirty, and the backend answers each switch with one aggregated query instead of the
 * page crunching rows itself.
 */
export function AnalyticsPage() {
  const { t } = useI18n();
  const [range, setRange] = useState<UsageRange>("today");
  const { error, loading, usage } = useAppUsage(range);
  const peak = usage[0]?.seconds ?? 0;

  const duration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);

    return hours > 0
      ? t("analytics.usage.hours", { hours, minutes })
      : t("analytics.usage.minutes", { minutes });
  };

  return (
    <>
      <h1>{t("nav.analytics")}</h1>
      <section className="analytics-section">
        <div className="analytics-head">
          <h2>{t("analytics.usage.title")}</h2>
          <SegmentedControl
            label={t("analytics.range.label")}
            onChange={setRange}
            options={USAGE_RANGES.map((value) => ({
              label: t(`analytics.range.${value}`),
              value,
            }))}
            value={range}
          />
        </div>
        {loading ? <p className="muted">{t("analytics.loading")}</p> : null}
        {error !== null ? <p className="error">{t("analytics.usage.error")}</p> : null}
        {!loading && error === null && usage.length === 0 ? (
          <p className="muted">{t("analytics.usage.empty")}</p>
        ) : null}
        {usage.length > 0 ? (
          <ul className="usage-list">
            {usage.map((entry) => (
              <li className="usage-row" key={entry.appName}>
                <span className="usage-app" title={entry.appName}>
                  {entry.appName}
                </span>
                <span className="usage-bar">
                  <span style={{ width: `${Math.round((entry.seconds / peak) * 100)}%` }} />
                </span>
                <span className="usage-time">{duration(entry.seconds)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
