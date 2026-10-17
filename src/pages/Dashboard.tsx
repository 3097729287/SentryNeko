/** Dashboard: today's focus, the timer, the tasks and the next reminder at a glance. */

import { useEffect } from "react";
import { Link } from "react-router-dom";

import { useAlarms } from "../hooks/useAlarms";
import { useAppUsage } from "../hooks/useAppEvents";
import { useCompletionRate } from "../hooks/useCompletionRate";
import { useFocusTrend } from "../hooks/useFocusTrend";
import { useI18n } from "../hooks/useI18n";
import { usePomodoro } from "../hooks/usePomodoro";
import { useTodos } from "../hooks/useTodos";
import { ALL_DAYS, clockTime, isOneOff, maskDays } from "../types/alarm";
import type { Alarm } from "../types/alarm";
import { phaseSeconds } from "../types/pomodoro";

/** Local weekday label of an epoch second. */
function weekday(seconds: number, language: string): string {
  return new Date(seconds * 1000).toLocaleDateString(language, { weekday: "short" });
}

/** `mm:ss` still to run in a phase. */
function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Next enabled alarm and when it rings, or `null` when none is switched on.
 *
 * The scan walks the next week, so a repeating alarm that already passed today lands on its next
 * selected weekday; a one-off rings at its next occurrence, which is today or tomorrow.
 */
function nextRing(alarms: readonly Alarm[], now: Date): { alarm: Alarm; at: Date } | null {
  let best: { alarm: Alarm; at: Date } | null = null;

  for (const alarm of alarms) {
    if (!alarm.enabled) {
      continue;
    }

    for (let offset = 0; offset < 8; offset += 1) {
      const at = new Date(now);
      at.setDate(at.getDate() + offset);
      at.setHours(alarm.hour, alarm.minute, 0, 0);

      // Monday is bit 0 of the mask, so Sunday (0) wraps to 6.
      const day = (at.getDay() + 6) % 7;

      if (at <= now || (!isOneOff(alarm) && (alarm.repeatDays & (1 << day)) === 0)) {
        continue;
      }

      if (best === null || at < best.at) {
        best = { alarm, at };
      }

      break;
    }
  }

  return best;
}

/** The timer block, kept apart so its quarter-second tick re-renders only these lines. */
function PomodoroCard() {
  const { t } = useI18n();
  const { durations, endsAt, load, phase, remainingMs } = usePomodoro();

  useEffect(() => {
    void load();
  }, [load]);

  const total = phaseSeconds(durations, phase) * 1000;
  const done = total === 0 ? 0 : Math.min(100, Math.round(((total - remainingMs) / total) * 100));

  return (
    <section className="dash-panel">
      <p className="dash-kicker">{t("dashboard.pomodoro.title")}</p>
      <p className="dash-timer">{countdown(remainingMs)}</p>
      <p className="dash-note">
        {t(`pomodoro.phase.${phase}`)}
        {" · "}
        {endsAt === null ? t("dashboard.pomodoro.idle") : t("dashboard.pomodoro.running")}
      </p>
      <span aria-hidden="true" className="meter">
        <span style={{ width: `${done}%` }} />
      </span>
      <Link className="dash-link" to="/pomodoro">
        {t("dashboard.pomodoro.open")}
      </Link>
    </section>
  );
}

/** Renders the dashboard. */
export function Dashboard() {
  const { language, t } = useI18n();
  const { buckets, error: trendError, loading: trendLoading } = useFocusTrend("day");
  const {
    completion,
    error: rateError,
    loading: rateLoading,
  } = useCompletionRate("today");
  const { error: appsError, loading: appsLoading, usage } = useAppUsage("today");
  const { counts, refresh } = useTodos();
  const { alarms, error: alarmError, loading: alarmLoading } = useAlarms();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const today = buckets.at(-1);
  const week = buckets.slice(-7);
  const peakDay = Math.max(...week.map((bucket) => bucket.focusSeconds), 1);
  const average =
    week.length === 0
      ? 0
      : Math.round(week.reduce((sum, bucket) => sum + bucket.focusSeconds, 0) / week.length);
  const focusSeconds = today?.focusSeconds ?? 0;
  const hours = Math.floor(focusSeconds / 3_600);
  const minutes = Math.floor((focusSeconds % 3_600) / 60);
  const peakApp = usage[0]?.seconds ?? 1;
  const percent =
    completion.total === 0 ? 0 : Math.round((completion.completed / completion.total) * 100);
  const next = nextRing(alarms, new Date());

  /** A duration in the units the page reads best, e.g. `1h 20m` or `1小时 20分`. */
  const span = (seconds: number): string => {
    const wholeHours = Math.floor(seconds / 3_600);
    const rest = Math.floor((seconds % 3_600) / 60);

    return wholeHours > 0
      ? `${wholeHours}${t("dashboard.hours")} ${rest}${t("dashboard.minutes")}`
      : `${rest}${t("dashboard.minutes")}`;
  };

  const repeat = (alarm: Alarm): string => {
    if (isOneOff(alarm)) {
      return t("dashboard.alarm.once");
    }

    if (alarm.repeatDays === ALL_DAYS) {
      return t("dashboard.alarm.everyday");
    }

    return maskDays(alarm.repeatDays)
      .map((day) => t(`alarm.weekday.${day}`))
      .join(" ");
  };

  return (
    <>
      <h1>{t("nav.dashboard")}</h1>
      <div className="dash">
        <section className="dash-panel dash-hero">
          <p className="dash-kicker">{t("dashboard.focus.title")}</p>
          {trendLoading ? <p className="dash-muted">{t("dashboard.loading")}</p> : null}
          {trendError !== null ? <p className="error">{t("dashboard.error")}</p> : null}
          {!trendLoading && trendError === null && today !== undefined ? (
            <>
              <p className="dash-clock">
                {hours > 0 ? (
                  <>
                    <span>{hours}</span>
                    <span className="dash-unit">{t("dashboard.hours")}</span>
                  </>
                ) : null}
                <span>{minutes}</span>
                <span className="dash-unit">{t("dashboard.minutes")}</span>
              </p>
              <p className="dash-note">
                {t("dashboard.focus.completed", { count: today.completedTasks })}
              </p>
              <p className="dash-note">
                {t("dashboard.focus.average", { value: span(average) })}
              </p>
              <div aria-label={t("dashboard.pulse.label")} className="dash-pulse" role="img">
                {week.map((bucket) => (
                  <span
                    className="dash-day"
                    data-today={bucket.start === today.start}
                    key={bucket.start}
                    title={t("dashboard.pulse.point", {
                      day: weekday(bucket.start, language),
                      minutes: Math.round(bucket.focusSeconds / 60),
                    })}
                  >
                    <span className="dash-day-track">
                      <span
                        className="dash-day-bar"
                        style={{
                          height: `${Math.max(
                            2,
                            Math.round((bucket.focusSeconds / peakDay) * 100),
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="dash-day-label">{weekday(bucket.start, language)}</span>
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </section>
        <PomodoroCard />
        <section className="dash-panel">
          <p className="dash-kicker">{t("dashboard.rate.title")}</p>
          {rateLoading ? <p className="dash-muted">{t("dashboard.loading")}</p> : null}
          {rateError !== null ? <p className="error">{t("dashboard.error")}</p> : null}
          {!rateLoading && rateError === null ? (
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
        <section className="dash-panel">
          <p className="dash-kicker">{t("dashboard.todos.title")}</p>
          <p className="dash-count">
            {counts.remaining}
            <span className="dash-unit">{t("dashboard.todos.remaining")}</span>
          </p>
          <p className="dash-note">
            {t("dashboard.todos.completed", { count: counts.completed })}
          </p>
          <Link className="dash-link" to="/todos">
            {t("dashboard.todos.open")}
          </Link>
        </section>
        <section className="dash-panel">
          <p className="dash-kicker">{t("dashboard.apps.title")}</p>
          {appsLoading ? <p className="dash-muted">{t("dashboard.loading")}</p> : null}
          {appsError !== null ? <p className="error">{t("dashboard.error")}</p> : null}
          {!appsLoading && appsError === null ? (
            usage.length === 0 ? (
              <p className="dash-muted">{t("dashboard.apps.empty")}</p>
            ) : (
              <>
                <ul className="dash-apps">
                  {usage.slice(0, 3).map((entry) => (
                    <li className="dash-app" key={entry.appName}>
                      <span className="dash-app-name" title={entry.appName}>
                        {entry.appName}
                      </span>
                      <span className="dash-app-time">{span(entry.seconds)}</span>
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
        <section className="dash-panel dash-wide">
          <p className="dash-kicker">{t("dashboard.alarm.title")}</p>
          {alarmLoading ? <p className="dash-muted">{t("dashboard.loading")}</p> : null}
          {alarmError !== null ? <p className="error">{t("dashboard.error")}</p> : null}
          {!alarmLoading && alarmError === null ? (
            next === null ? (
              <p className="dash-muted">{t("dashboard.alarm.empty")}</p>
            ) : (
              <div className="dash-alarm">
                <span className="dash-alarm-time">
                  {clockTime(next.alarm.hour, next.alarm.minute)}
                </span>
                <span className="dash-alarm-label">
                  {next.alarm.label || t("dashboard.alarm.untitled")}
                </span>
                <span className="dash-note">{repeat(next.alarm)}</span>
                <Link className="dash-link" to="/alarms">
                  {t("dashboard.alarm.open")}
                </Link>
              </div>
            )
          ) : null}
        </section>
      </div>
    </>
  );
}
