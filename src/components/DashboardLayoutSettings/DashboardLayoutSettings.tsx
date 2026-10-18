/** Dashboard layout settings: how many columns the grid has, and where each panel sits. */

import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { useI18n } from "../../hooks/useI18n";
import { DASHBOARD_COLUMNS } from "../../types/dashboard";
import { SegmentedControl } from "../ui/SegmentedControl";
import { LayoutPreview } from "./LayoutPreview";

/** Column picker plus the live editor; every change lands in the dashboard immediately. */
export function DashboardLayoutSettings() {
  const { t } = useI18n();
  const { layout, move, reset, resize, setColumns } = useDashboardLayout();

  return (
    <div className="layout-settings">
      <div className="layout-columns">
        <span className="layout-label">{t("dashboard.layout.columns")}</span>
        <SegmentedControl
          label={t("dashboard.layout.columns")}
          onChange={(next) => {
            setColumns(Number(next));
          }}
          options={DASHBOARD_COLUMNS.map((value) => ({
            label: String(value),
            value: String(value),
          }))}
          value={String(layout.columns)}
        />
      </div>
      <LayoutPreview layout={layout} onMove={move} onResize={resize} />
      <div className="layout-foot">
        <p className="layout-note">{t("dashboard.layout.hint")}</p>
        <button className="btn" onClick={reset} type="button">
          {t("dashboard.layout.reset")}
        </button>
      </div>
    </div>
  );
}
