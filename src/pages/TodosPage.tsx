/** Todo page. */

import { useI18n } from "../hooks/useI18n";

/** Renders the todo list page. */
export function TodosPage() {
  const { t } = useI18n();

  return (
    <>
      <h1>{t("nav.todos")}</h1>
      <div className="empty">
        <p>{t("pages.empty")}</p>
      </div>
    </>
  );
}
