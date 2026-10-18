/** Layout editor: the real dashboard panels, dragged into shape and saved as a whole. */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { useI18n } from "../../hooks/useI18n";
import { DASHBOARD_PANELS } from "../../pages/Dashboard/panels";
import {
  DASHBOARD_COLUMNS,
  DASHBOARD_WIDGETS,
  clampPlacement,
  minSizeOf,
  moveWidget,
  resizeWidget,
} from "../../types/dashboard";
import type { DashboardLayout, DashboardWidgetId, WidgetPlacement } from "../../types/dashboard";
import { ActionIcon } from "../ui/ActionIcon";
import { SegmentedControl } from "../ui/SegmentedControl";
import { useDraftLayout } from "./useDraftLayout";

interface DashboardLayoutEditorProps {
  onClose: () => void;
}

interface DragState {
  id: DashboardWidgetId;
  mode: "move" | "resize";
  pointerId: number;
  /** Pointer position when the gesture started. */
  clientX: number;
  clientY: number;
  /** The panel's rectangle when the gesture started, so every frame measures from the same origin. */
  origin: WidgetPlacement;
  /** Draft the gesture started from, used to drop the undo step of a drag that moved nothing. */
  startLayout: DashboardLayout;
}

/**
 * A panel inside the editor never changes while a drag runs, so keeping it out of the re-render
 * loop leaves the pointer frames cheap even with six live panels on screen.
 */
const EditorPanel = memo(function EditorPanel({ id }: { id: DashboardWidgetId }) {
  const Panel = DASHBOARD_PANELS[id];

  return <Panel />;
});

function samePlacement(a: WidgetPlacement, b: WidgetPlacement): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** Full-window editor; the grid is the dashboard itself, one pointer drag away from the layout. */
export function DashboardLayoutEditor({ onClose }: DashboardLayoutEditorProps) {
  const { t } = useI18n();
  const { layout: saved, save } = useDashboardLayout();
  const draft = useDraftLayout(saved);
  const { layout } = draft;

  const gridRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Latest draft for the pointer handlers, which fire between renders. */
  const layoutRef = useRef(layout);
  const [metrics, setMetrics] = useState({ cell: 0, gap: 0 });
  const [dragging, setDragging] = useState<DashboardWidgetId | null>(null);

  layoutRef.current = layout;

  // Cell size and gap come from the rendered grid, so dragging maps pixels to cells exactly.
  useEffect(() => {
    const grid = gridRef.current;

    if (!grid) {
      return;
    }

    const measure = (): void => {
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      const width = grid.getBoundingClientRect().width;
      const cell = (width - (layout.columns - 1) * gap) / layout.columns;

      setMetrics({ cell: Number.isFinite(cell) && cell > 0 ? cell : 0, gap });
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(grid);

    return () => {
      observer.disconnect();
    };
  }, [layout.columns]);

  const commit = useCallback(() => {
    save(layoutRef.current);
    onClose();
  }, [onClose, save]);

  // Ctrl+S saves, Ctrl+Z undoes one step, Escape leaves the draft untouched.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        commit();
        return;
      }

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        draft.undo();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [commit, draft.undo, onClose]);

  // The page behind must not scroll while the editor owns the window.
  useEffect(() => {
    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const step = metrics.cell + metrics.gap;

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    const state = dragRef.current;

    if (!state || event.pointerId !== state.pointerId || step <= 0) {
      return;
    }

    const current = layoutRef.current;
    const dx = Math.round((event.clientX - state.clientX) / step);
    const dy = Math.round((event.clientY - state.clientY) / step);
    const min = minSizeOf(state.id);

    if (state.mode === "move") {
      const target = clampPlacement(
        state.id,
        { ...state.origin, x: state.origin.x + dx, y: state.origin.y + dy },
        current.columns,
      );

      if (samePlacement(current.placements[state.id], target)) {
        return;
      }

      draft.drag(moveWidget(current, state.id, target));
      return;
    }

    const size = {
      h: Math.max(min.h, state.origin.h + dy),
      w: Math.min(current.columns - state.origin.x, Math.max(min.w, state.origin.w + dx)),
    };

    if (size.w === current.placements[state.id].w && size.h === current.placements[state.id].h) {
      return;
    }

    draft.drag(resizeWidget(current, state.id, size));
  };

  const beginDrag = (
    event: ReactPointerEvent<HTMLElement>,
    id: DashboardWidgetId,
    mode: DragState["mode"],
  ): void => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      id,
      mode,
      origin: layoutRef.current.placements[id],
      pointerId: event.pointerId,
      startLayout: layoutRef.current,
    };
    // One undo step for the whole gesture, not one per frame.
    draft.begin();
    setDragging(id);
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    const state = dragRef.current;

    if (state === null) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setDragging(null);

    // A click that moved nothing should not cost the user an undo press.
    if (layoutRef.current === state.startLayout) {
      draft.abort();
    }
  };

  /** Arrow keys nudge a panel; holding shift resizes it instead. */
  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    id: DashboardWidgetId,
  ): void => {
    const placement = layout.placements[id];
    const min = minSizeOf(id);
    const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";

    if (!horizontal && !vertical) {
      return;
    }

    event.preventDefault();

    const sign = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;

    if (event.shiftKey) {
      const size = { h: placement.h, w: placement.w };

      if (horizontal) {
        size.w = Math.min(layout.columns - placement.x, Math.max(min.w, placement.w + sign));
      } else {
        size.h = Math.max(min.h, placement.h + sign);
      }

      draft.resize(id, size);
      return;
    }

    draft.move(
      id,
      clampPlacement(
        id,
        {
          ...placement,
          x: horizontal ? placement.x + sign : placement.x,
          y: vertical ? placement.y + sign : placement.y,
        },
        layout.columns,
      ),
    );
  };

  return (
    <div className="editor-overlay">
      <div
        aria-label={t("dashboard.layout.title")}
        aria-modal="true"
        className="editor-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="editor-head">
          <div className="editor-lead">
            <h2>{t("dashboard.layout.title")}</h2>
            <p className="editor-sub">{t("dashboard.layout.rowHint")}</p>
          </div>
          <div className="editor-columns">
            <span className="layout-label">{t("dashboard.layout.columns")}</span>
            <SegmentedControl
              label={t("dashboard.layout.columns")}
              onChange={(next) => {
                draft.setColumns(Number(next));
              }}
              options={DASHBOARD_COLUMNS.map((value) => ({
                label: String(value),
                value: String(value),
              }))}
              value={String(layout.columns)}
            />
          </div>
          <div className="editor-actions">
            <button
              aria-label={t("dashboard.layout.undo")}
              className="icon-btn"
              disabled={!draft.canUndo}
              onClick={draft.undo}
              title={t("dashboard.layout.undo")}
              type="button"
            >
              <ActionIcon name="undo" />
            </button>
            <button
              aria-label={t("dashboard.layout.reset")}
              className="icon-btn"
              onClick={draft.reset}
              title={t("dashboard.layout.reset")}
              type="button"
            >
              <ActionIcon name="reset" />
            </button>
            <button
              aria-label={t("dashboard.layout.cancel")}
              className="icon-btn"
              onClick={onClose}
              title={t("dashboard.layout.cancel")}
              type="button"
            >
              <ActionIcon name="cancel" />
            </button>
            <button
              aria-label={t("dashboard.layout.save")}
              className="icon-btn"
              data-variant="primary"
              disabled={!draft.dirty}
              onClick={commit}
              title={t("dashboard.layout.save")}
              type="button"
            >
              <ActionIcon name="check" />
            </button>
          </div>
        </header>

        <div className="editor-body">
          <div className="dash-grid">
            <div
              className="dash-cells"
              ref={gridRef}
              style={{ "--dash-columns": layout.columns } as CSSProperties}
            >
              {DASHBOARD_WIDGETS.map((id) => {
                const placement = layout.placements[id];

                return (
                  <div
                    className="dash-slot editor-slot"
                    data-dragging={dragging === id}
                    key={id}
                    style={{
                      gridColumn: `${placement.x + 1} / span ${placement.w}`,
                      gridRow: `${placement.y + 1} / span ${placement.h}`,
                    }}
                  >
                    <EditorPanel id={id} />
                    <span
                      aria-label={t("dashboard.widget.move", {
                        name: t(`dashboard.widget.${id}`),
                      })}
                      className="editor-mask"
                      onKeyDown={(event) => {
                        handleKeyDown(event, id);
                      }}
                      onPointerCancel={endDrag}
                      onPointerDown={(event) => {
                        beginDrag(event, id, "move");
                      }}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endDrag}
                      role="button"
                      tabIndex={0}
                    />
                    <span
                      aria-hidden="true"
                      className="editor-grip"
                      onPointerCancel={endDrag}
                      onPointerDown={(event) => {
                        beginDrag(event, id, "resize");
                      }}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endDrag}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="editor-foot">
          <span className="editor-note">{t("dashboard.layout.hint")}</span>
          <span className="editor-shortcuts">{t("dashboard.layout.shortcuts")}</span>
        </footer>
      </div>
    </div>
  );
}
