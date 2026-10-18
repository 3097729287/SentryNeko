/** Dashboard layout hook: the saved grid plus the action that replaces it. */

import { useDashboardLayoutStore } from "../stores/dashboardLayoutStore";
import type { DashboardLayout } from "../types/dashboard";

export interface UseDashboardLayoutResult {
  layout: DashboardLayout;
  save: (layout: DashboardLayout) => void;
}

/** Layout and saving for a component. */
export function useDashboardLayout(): UseDashboardLayoutResult {
  const layout = useDashboardLayoutStore((state) => state.layout);
  const save = useDashboardLayoutStore((state) => state.save);

  return { layout, save };
}
