/** Todos panel: what is still open today. */

import { useEffect } from "react";
import { Link } from "react-router-dom";

import { useI18n } from "../../../hooks/useI18n";
import { useTodos } from "../../../hooks/useTodos";

/** Remaining task count with a link to the full list. */
export function TodosWidget() {
  const { t } = useI18n();
  const { counts, refresh } = useTodos();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="dash-panel">
      <p className="dash-kicker">{t("dashboard.todos.title")}</p>
      <p className="dash-count">
        {counts.remaining}
        <span className="dash-unit">{t("dashboard.todos.remaining")}</span>
      </p>
      <p className="dash-note">{t("dashboard.todos.completed", { count: counts.completed })}</p>
      <Link className="dash-link" to="/todos">
        {t("dashboard.todos.open")}
      </Link>
    </section>
  );
}
