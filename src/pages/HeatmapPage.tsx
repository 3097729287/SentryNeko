/** Heatmap page. */

import { useI18n } from "../hooks/useI18n";

/** Renders the focus heatmap page. */
export function HeatmapPage() {
  const { t } = useI18n();

  return (
    <>
      <h1>{t("nav.heatmap")}</h1>
      <div className="empty">
        <p>{t("pages.empty")}</p>
      </div>
    </>
  );
}
