/** Live list of the foreground switches the collector pushes. */

import { useI18n } from "../hooks/useI18n";
import type { AppEvent } from "../types/appEvent";

/** Local date and time of an epoch second, formatted in the language the app runs in. */
function stamp(seconds: number, language: string): string {
  return new Date(seconds * 1000).toLocaleString(language, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

interface AppEventLogProps {
  /** Episodes to show, newest first. */
  events: readonly AppEvent[];
}

/** Renders one row per switch; the empty state tells the user the push works, not the data. */
export function AppEventLog({ events }: AppEventLogProps) {
  const { language, t } = useI18n();

  if (events.length === 0) {
    return <p className="muted">{t("events.log.empty")}</p>;
  }

  return (
    <ul className="event-log">
      {events.map((event) => (
        <li className="event-row" key={event.id}>
          <span className="event-app">{event.appName}</span>
          <span className="event-title">{event.windowTitle ?? t("events.log.untitled")}</span>
          <span className="event-time muted">{stamp(event.startedAt, language)}</span>
        </li>
      ))}
    </ul>
  );
}
