/** Draft layout for the editor: every edit stays here until the user saves. */

import { useCallback, useState } from "react";

import {
  DASHBOARD_WIDGETS,
  defaultLayout,
  hideWidget,
  moveWidget,
  resizeWidget,
  showWidget,
  withColumns,
} from "../../types/dashboard";
import type { DashboardLayout, DashboardWidgetId, WidgetPlacement } from "../../types/dashboard";

export interface DraftLayoutResult {
  layout: DashboardLayout;
  /** True while the draft differs from the layout the editor opened with. */
  dirty: boolean;
  canUndo: boolean;
  /** Puts a parked panel back on the grid, at `placement` or the first gap when none is given. */
  add: (id: DashboardWidgetId, placement?: WidgetPlacement) => void;
  /** Takes a panel off the grid into the library. */
  remove: (id: DashboardWidgetId) => void;
  setColumns: (columns: number) => void;
  move: (id: DashboardWidgetId, placement: WidgetPlacement) => void;
  resize: (id: DashboardWidgetId, size: { w: number; h: number }) => void;
  undo: () => void;
  reset: () => void;
}

function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  if (a.columns !== b.columns) {
    return false;
  }

  return DASHBOARD_WIDGETS.every((id) => {
    if (a.hidden.includes(id) !== b.hidden.includes(id)) {
      return false;
    }

    const left = a.placements[id];
    const right = b.placements[id];

    return left.x === right.x && left.y === right.y && left.w === right.w && left.h === right.h;
  });
}

/**
 * Local copy of `initial` plus an undo stack; nothing reaches the store until the caller saves.
 *
 * One call is one undo step, which is why a drag is applied only when the pointer is released:
 * the frames in between are a preview, not a layout.
 */
export function useDraftLayout(initial: DashboardLayout): DraftLayoutResult {
  const [layout, setLayout] = useState(initial);
  const [history, setHistory] = useState<readonly DashboardLayout[]>([]);

  /** Records the current draft, then shows `next`. */
  const edit = useCallback(
    (next: DashboardLayout) => {
      if (sameLayout(layout, next)) {
        return;
      }

      setHistory((past) => [...past, layout]);
      setLayout(next);
    },
    [layout],
  );

  const undo = useCallback(() => {
    const previous = history.at(-1);

    if (previous === undefined) {
      return;
    }

    setHistory(history.slice(0, -1));
    setLayout(previous);
  }, [history]);

  const setColumns = useCallback(
    (columns: number) => {
      edit(withColumns(layout, columns));
    },
    [edit, layout],
  );

  const move = useCallback(
    (id: DashboardWidgetId, placement: WidgetPlacement) => {
      edit(moveWidget(layout, id, placement));
    },
    [edit, layout],
  );

  const resize = useCallback(
    (id: DashboardWidgetId, size: { w: number; h: number }) => {
      edit(resizeWidget(layout, id, size));
    },
    [edit, layout],
  );

  const add = useCallback(
    (id: DashboardWidgetId, placement?: WidgetPlacement) => {
      edit(showWidget(layout, id, placement));
    },
    [edit, layout],
  );

  const remove = useCallback(
    (id: DashboardWidgetId) => {
      edit(hideWidget(layout, id));
    },
    [edit, layout],
  );

  const reset = useCallback(() => {
    edit(defaultLayout(layout.columns));
  }, [edit, layout.columns]);

  return {
    add,
    canUndo: history.length > 0,
    dirty: !sameLayout(layout, initial),
    layout,
    move,
    remove,
    reset,
    resize,
    setColumns,
    undo,
  };
}
