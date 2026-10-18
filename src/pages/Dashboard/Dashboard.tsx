/** Dashboard: the arranged grid of panels, each loading its own data. */

import type { CSSProperties } from "react";

import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { useI18n } from "../../hooks/useI18n";
import { DASHBOARD_WIDGETS } from "../../types/dashboard";
import { DASHBOARD_PANELS } from "./panels";

/** Renders the dashboard in the grid the user arranged in the layout editor. */
export function Dashboard() {
  const { t } = useI18n();
  const { layout } = useDashboardLayout();

  return (
    <>
      <h1>{t("nav.dashboard")}</h1>
      <div className="dash-grid">
        <div
          className="dash-cells"
          style={{ "--dash-columns": layout.columns } as CSSProperties}
        >
          {DASHBOARD_WIDGETS.map((id) => {
            const placement = layout.placements[id];
            const Panel = DASHBOARD_PANELS[id];

            return (
              <div
                className="dash-slot"
                key={id}
                style={{
                  gridColumn: `${placement.x + 1} / span ${placement.w}`,
                  gridRow: `${placement.y + 1} / span ${placement.h}`,
                }}
              >
                <Panel />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
