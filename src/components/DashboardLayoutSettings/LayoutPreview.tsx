/** Layout preview: a to-scale grid the user drags panels around on, live. */

import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { useI18n } from "../../hooks/useI18n";
import { DASHBOARD_WIDGETS, clampPlacement, minSizeOf } from "../../types/dashboard";
import type {
  DashboardLayout,
  DashboardWidgetId,
  WidgetPlacement,
} from "../../types/dashboard";

/** Gap between preview cells; the measured cell size is derived from it. */
const GAP = 12;

interface LayoutPreviewProps {
  layout: DashboardLayout;
  onMove: (id: DashboardWidgetId, placement: WidgetPlacement) => void;
  onResize: (id: DashboardWidgetId, size: { w: number; h: number }) => void;
}

interface Drag {
  id: DashboardWidgetId;
  mode: "move" | "resize";
  pointerId: number;
  /** Pointer position when the drag started. */
  clientX: number;
  clientY: number;
  /** Where the panel was when the drag started, so every step measures from the same origin. */
  origin: WidgetPlacement;
}

function samePlacement(a: WidgetPlacement | null, b: WidgetPlacement): boolean {
  return a !== null && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** Grid of labelled cells; drag a cell to move it, drag its corner to resize it. */
export function LayoutPreview({ layout, onMove, onResize }: LayoutPreviewProps) {
  const { t } = useI18n();
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  /** Last placement handed to the store, so a pointer moving inside one cell sends nothing. */
  const lastRef = useRef<WidgetPlacement | null>(null);
  const [cellSize, setCellSize] = useState(0);
  const [dragging, setDragging] = useState<DashboardWidgetId | null>(null);

  // The preview keeps the real proportions, so a cell is square here too.
  useEffect(() => {
    const grid = gridRef.current;

    if (!grid) {
      return;
    }

    const measure = (): void => {
      const width = grid.getBoundingClientRect().width;
      const size = (width - (layout.columns - 1) * GAP) / layout.columns;

      setCellSize(Number.isFinite(size) && size > 0 ? size : 0);
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(grid);

    return () => {
      observer.disconnect();
    };
  }, [layout.columns]);

  const step = cellSize + GAP;

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    const drag = dragRef.current;

    if (!drag || event.pointerId !== drag.pointerId || step <= 0) {
      return;
    }

    const dx = Math.round((event.clientX - drag.clientX) / step);
    const dy = Math.round((event.clientY - drag.clientY) / step);
    const min = minSizeOf(drag.id);

    if (drag.mode === "move") {
      const next = clampPlacement(
        drag.id,
        { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy },
        layout.columns,
      );

      if (samePlacement(lastRef.current, next)) {
        return;
      }

      lastRef.current = next;
      onMove(drag.id, next);
      return;
    }

    const next: WidgetPlacement = {
      ...drag.origin,
      h: Math.max(min.h, drag.origin.h + dy),
      w: Math.min(layout.columns - drag.origin.x, Math.max(min.w, drag.origin.w + dx)),
    };

    if (samePlacement(lastRef.current, next)) {
      return;
    }

    lastRef.current = next;
    onResize(drag.id, { h: next.h, w: next.w });
  };

  const beginDrag = (
    event: ReactPointerEvent<HTMLElement>,
    id: DashboardWidgetId,
    mode: Drag["mode"],
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
      origin: layout.placements[id],
      pointerId: event.pointerId,
    };
    lastRef.current = layout.placements[id];
    setDragging(id);
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    if (dragRef.current === null) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    lastRef.current = null;
    setDragging(null);
  };

  /** Arrow keys nudge a panel; holding shift resizes it instead. */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>, id: DashboardWidgetId): void => {
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

      onResize(id, size);
      return;
    }

    onMove(
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
    <div className="layout-preview">
      <div
        className="layout-preview-grid"
        ref={gridRef}
        style={{ "--layout-columns": layout.columns } as CSSProperties}
      >
        {DASHBOARD_WIDGETS.map((id) => {
          const placement = layout.placements[id];

          return (
            <div
              aria-label={t("dashboard.widget.move", { name: t(`dashboard.widget.${id}`) })}
              className="layout-cell"
              data-dragging={dragging === id}
              key={id}
              onKeyDown={(event) => {
                handleKeyDown(event, id);
              }}
              onPointerCancel={endDrag}
              onPointerDown={(event) => {
                beginDrag(event, id, "move");
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              role="group"
              style={{
                gridColumn: `${placement.x + 1} / span ${placement.w}`,
                gridRow: `${placement.y + 1} / span ${placement.h}`,
              }}
              tabIndex={0}
            >
              <span className="layout-cell-name">{t(`dashboard.widget.${id}`)}</span>
              <span className="layout-cell-size">
                {t("dashboard.widget.size", { w: placement.w, h: placement.h })}
              </span>
              <span
                aria-hidden="true"
                className="layout-cell-grip"
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
  );
}
