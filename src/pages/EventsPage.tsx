/** Foreground application event stream page. */

import { AppEventLog } from "../components/AppEventLog";
import { useAppEventPage } from "../hooks/useAppEventPage";
import { useI18n } from "../hooks/useI18n";
import { useAppEventStore } from "../stores/appEventStore";

/**
 * Renders the stream newest first: one page from the database, plus the switches the shell keeps
 * pushing into the store, so the list stays current while the page is open.
 */
export function EventsPage() {
  const { t } = useI18n();
  const live = useAppEventStore((state) => state.live);
  const { error, events, hasMore, loadMore, loading, loadingMore } = useAppEventPage();

  // Pushes are newer than every loaded row, so they only fill the gap at the top.
  const known = new Set(events.map((event) => event.id));
  const rows = [...live.filter((event) => !known.has(event.id)), ...events];

  return (
    <>
      <h1>{t("nav.events")}</h1>
      <section className="card">
        <h2>{t("events.log.title")}</h2>
        {loading ? <p className="muted">{t("events.loading")}</p> : null}
        {error !== null ? <p className="error">{t("events.error")}</p> : null}
        {!loading && error === null ? (
          <>
            <AppEventLog events={rows} />
            {hasMore ? (
              <button className="btn" disabled={loadingMore} onClick={loadMore} type="button">
                {loadingMore ? t("events.more.loading") : t("events.more.label")}
              </button>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}
