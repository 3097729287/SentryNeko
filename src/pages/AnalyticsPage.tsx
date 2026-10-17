/** Analytics page: app usage ranking, focus trends and task completion rate. */

import { useState } from "react";

import { FocusTrendChart } from "../components/FocusTrendChart";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useAppUsage } from "../hooks/useAppEvents";
import { useFocusTrend } from "../hooks/useFocusTrend";
import { useI18n } from "../hooks/useI18n";
import { USAGE_RANGES } from "../types/appEvent";
import type { UsageRange } from "../types/appEvent";
import type { HeatmapGranularity } from "../types/heatmap";
import { TREND_GRANULARITIES } from "../types/trend";

/** The copy a duration is written with, so the usage ranking and the trend share one formatter. */
interface DurationKeys {
  /** Used from one hour on. */
  hours: string;
  minutes: string;
}

const USAGE_DURATION: DurationKeys = {
  hours: "analytics.usage.hours",
  minutes: "analytics.usage.minutes",
};

const TREND_DURATION: DurationKeys = {
  hours: "analytics.trend.totalHours",
  minutes: "analytics.trend.totalMinutes",
};

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
  const [granularity, setGranularity] = useState<HeatmapGranularity>("day");
  const { error, loading, usage } = useAppUsage(range);
  const {
    buckets,
    error: trendError,
    loading: trendLoading,
    totalSeconds,
  } = useFocusTrend(granularity);
  const peak = usage[0]?.seconds ?? 0;

  /** Hours are only shown once there are any, so a short span reads as plain minutes. */
  const duration = (seconds: number, keys: DurationKeys): string => {
    const hours = Math.floor(seconds / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);

    return hours > 0 ? t(keys.hours, { hours, minutes }) : t(keys.minutes, { minutes });
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
                <span className="usage-time">{duration(entry.seconds, USAGE_DURATION)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="analytics-section">
        <div className="analytics-head">
          <h2>{t("analytics.trend.title")}</h2>
          <SegmentedControl
            label={t("analytics.trend.granularity.label")}
            onChange={setGranularity}
            options={TREND_GRANULARITIES.map((value) => ({
              label: t(`analytics.trend.granularity.${value}`),
              value,
            }))}
            value={granularity}
          />
        </div>
        {trendLoading ? <p className="muted">{t("analytics.loading")}</p> : null}
        {trendError !== null ? <p className="error">{t("analytics.trend.error")}</p> : null}
        {!trendLoading && trendError === null ? (
          <>
            <FocusTrendChart buckets={buckets} granularity={granularity} />
            {totalSeconds > 0 ? (
              <p className="muted">{duration(totalSeconds, TREND_DURATION)}</p>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}
