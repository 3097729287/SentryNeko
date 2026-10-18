/** Dashboard layout store: the grid the user arranged, mirrored in `localStorage`. */

import { create } from "zustand";

import { defaultLayout, isDashboardLayout, moveWidget, resizeWidget, withColumns } from "../types/dashboard";
import type {
  DashboardLayout,
  DashboardWidgetId,
  WidgetPlacement,
} from "../types/dashboard";

/** Key the layout is mirrored under; the browser preview and the app share it. */
export const DASHBOARD_LAYOUT_STORAGE_KEY = "sentryneko.dashboardLayout";

interface DashboardLayoutState {
  layout: DashboardLayout;
  /** Re-flows the grid onto `columns`. */
  setColumns: (columns: number) => void;
  /** Puts one panel somewhere else; whatever it covers drops below it. */
  move: (id: DashboardWidgetId, placement: WidgetPlacement) => void;
  /** Grows or shrinks one panel, re-flowing what it covers. */
  resize: (id: DashboardWidgetId, size: { w: number; h: number }) => void;
  /** Restores the layout a fresh install shows. */
  reset: () => void;
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

function mirror(layout: DashboardLayout): void {
  try {
    localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage disabled: the layout still applies for this session.
  }
}

export const useDashboardLayoutStore = create<DashboardLayoutState>((set, get) => {
  /** Applies `next`, mirrors it and hands it back to the caller. */
  const apply = (next: DashboardLayout): void => {
    mirror(next);
    set({ layout: next });
  };

  return {
    layout: mirroredLayout(),
    move: (id, placement) => {
      apply(moveWidget(get().layout, id, placement));
    },
    reset: () => {
      apply(defaultLayout(get().layout.columns));
    },
    resize: (id, size) => {
      apply(resizeWidget(get().layout, id, size));
    },
    setColumns: (columns) => {
      apply(withColumns(get().layout, columns));
    },
  };
});
