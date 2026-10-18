/** Dashboard layout hook: the arranged grid plus the actions that change it. */

import { useDashboardLayoutStore } from "../stores/dashboardLayoutStore";
import type { DashboardLayout, DashboardWidgetId, WidgetPlacement } from "../types/dashboard";

export interface UseDashboardLayoutResult {
  layout: DashboardLayout;
  setColumns: (columns: number) => void;
  move: (id: DashboardWidgetId, placement: WidgetPlacement) => void;
  resize: (id: DashboardWidgetId, size: { w: number; h: number }) => void;
  reset: () => void;
}

/** Grid and editing actions for a component. */
export function useDashboardLayout(): UseDashboardLayoutResult {
  const layout = useDashboardLayoutStore((state) => state.layout);
  const setColumns = useDashboardLayoutStore((state) => state.setColumns);
  const move = useDashboardLayoutStore((state) => state.move);
  const resize = useDashboardLayoutStore((state) => state.resize);
  const reset = useDashboardLayoutStore((state) => state.reset);

  return { layout, move, reset, resize, setColumns };
}
