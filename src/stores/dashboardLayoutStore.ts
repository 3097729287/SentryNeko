/** Dashboard layout store: the saved grid, mirrored in `localStorage`. */

import { create } from "zustand";

import { defaultLayout, isDashboardLayout } from "../types/dashboard";
import type { DashboardLayout } from "../types/dashboard";

/** Key the layout is mirrored under; the browser preview and the app share it. */
export const DASHBOARD_LAYOUT_STORAGE_KEY = "sentryneko.dashboardLayout";

interface DashboardLayoutState {
  layout: DashboardLayout;
  /**
   * Stores the layout the editor settled on.
   *
   * The editor keeps its own draft, so the page only ever renders a layout the user saved.
   */
  save: (layout: DashboardLayout) => void;
}

function mirroredLayout(): DashboardLayout {
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);

    if (raw === null) {
      return defaultLayout();
    }

    const parsed: unknown = JSON.parse(raw);

    return isDashboardLayout(parsed) ? parsed : defaultLayout();
  } catch {
    // Storage disabled or holding junk: fall back to the default grid.
    return defaultLayout();
  }
}

export const useDashboardLayoutStore = create<DashboardLayoutState>((set) => ({
  layout: mirroredLayout(),
  save: (layout) => {
    try {
      localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Storage disabled: the layout still applies for this session.
    }

    set({ layout });
  },
}));
