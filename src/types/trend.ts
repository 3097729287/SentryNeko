/** Focus trend window: the same buckets as the heatmap, over the span a chart can show. */

import type { HeatmapGranularity } from "./heatmap";

/** Every granularity, in the order the trend switcher shows them. */
export const TREND_GRANULARITIES = [
  "day",
  "week",
  "month",
] as const satisfies readonly HeatmapGranularity[];

/** Buckets a trend shows per granularity. */
export const TREND_BUCKETS: Record<HeatmapGranularity, number> = { day: 30, month: 12, week: 12 };

/**
 * Local-calendar window of a trend, in UTC epoch seconds, ending at `now`.
 *
 * A weekly window starts on a Monday and a monthly one on the first, so every bucket but the last
 * is a full period and the chart's columns are comparable.
 */
export function trendWindow(
  granularity: HeatmapGranularity,
  now = new Date(),
): { from: number; to: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (granularity === "day") {
    start.setDate(start.getDate() - (TREND_BUCKETS.day - 1));
  } else if (granularity === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    start.setDate(start.getDate() - (TREND_BUCKETS.week - 1) * 7);
  } else {
    start.setDate(1);
    start.setMonth(start.getMonth() - (TREND_BUCKETS.month - 1));
  }

  return { from: Math.floor(start.getTime() / 1000), to: Math.floor(now.getTime() / 1000) };
}
