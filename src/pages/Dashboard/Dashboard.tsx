/** Dashboard: the arranged grid of panels, each loading its own data. */

import type { CSSProperties, ReactNode } from "react";

import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { useI18n } from "../../hooks/useI18n";
import { DASHBOARD_WIDGETS } from "../../types/dashboard";
import type { DashboardWidgetId } from "../../types/dashboard";
import { AlarmWidget } from "./AlarmWidget/AlarmWidget";
import { CompletionWidget } from "./CompletionWidget/CompletionWidget";
import { FocusWidget } from "./FocusWidget/FocusWidget";
import { PomodoroWidget } from "./PomodoroWidget/PomodoroWidget";
import { TodosWidget } from "./TodosWidget/TodosWidget";
import { UsageWidget } from "./UsageWidget/UsageWidget";

/** Panel behind each id, so the grid only has to know where things go. */
const PANELS: Record<DashboardWidgetId, () => ReactNode> = {
  alarm: () => <AlarmWidget />,
  completion: () => <CompletionWidget />,
  focus: () => <FocusWidget />,
  pomodoro: () => <PomodoroWidget />,
  todos: () => <TodosWidget />,
  usage: () => <UsageWidget />,
};

/** Renders the dashboard in the grid the user arranged in the settings page. */
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

            return (
              <div
                className="dash-slot"
                key={id}
                style={{
                  gridColumn: `${placement.x + 1} / span ${placement.w}`,
                  gridRow: `${placement.y + 1} / span ${placement.h}`,
                }}
              >
                {PANELS[id]()}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
