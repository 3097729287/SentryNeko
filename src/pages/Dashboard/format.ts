/** Dashboard formatting: durations, clock labels and weekday names the panels read out. */

import type { TFunction } from "i18next";

/** Local weekday label of an epoch second. */
export function weekday(seconds: number, language: string): string {
  return new Date(seconds * 1000).toLocaleDateString(language, { weekday: "short" });
}

/** `mm:ss` still to run in a phase. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** A duration in the units the page reads best, e.g. `1h 20m` or `1小时 20分`. */
export function formatSpan(seconds: number, t: TFunction): string {
  const wholeHours = Math.floor(seconds / 3_600);
  const rest = Math.floor((seconds % 3_600) / 60);

  return wholeHours > 0
    ? `${wholeHours}${t("dashboard.hours")} ${rest}${t("dashboard.minutes")}`
    : `${rest}${t("dashboard.minutes")}`;
}
