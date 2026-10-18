/**
 * Preview scaling for the layout editor: the grid is drawn at its design width and then scaled to
 * whatever room the preview column has, so a whole layout stays in view while it is arranged.
 *
 * Panels are sized in cells, so any change in the room they are given would reflow everything
 * inside them; scaling instead keeps the arrangement the user is looking at identical to the page
 * they will get, just smaller.
 *
 * The measurements come from `offsetWidth`/`offsetHeight`, which ignore the transform this hook is
 * feeding, and the frame is watched rather than the grid so a resize is noticed.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface CanvasMetrics {
  /** Width of one cell, in the canvas's own pixels. */
  cell: number;
  /** Space between two cells, in the canvas's own pixels. */
  gap: number;
  /** Height of the grid before scaling, in pixels. */
  height: number;
  /** How much the canvas is scaled to fit the room it has. */
  scale: number;
}

export function useCanvasScale(columns: number): {
  frameRef: RefObject<HTMLDivElement | null>;
  gridRef: RefObject<HTMLDivElement | null>;
  metrics: CanvasMetrics;
} {
  const frameRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<CanvasMetrics>({ cell: 0, gap: 0, height: 0, scale: 1 });

  // Measured before the first paint, so the canvas is never drawn at the wrong size for a frame.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const grid = gridRef.current;

    if (!frame || !grid) {
      return;
    }

    const measure = (): void => {
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      const width = grid.offsetWidth;
      const room = frame.clientWidth;
      const cell = columns > 0 ? (width - (columns - 1) * gap) / columns : 0;
      const next: CanvasMetrics = {
        cell: cell > 0 ? cell : 0,
        gap,
        height: grid.offsetHeight,
        scale: width > 0 && room > 0 ? room / width : 1,
      };

      // Writing the frame's height moves the observer again; keeping the same object when nothing
      // changed is what stops the two from ping-ponging.
      setMetrics((current) =>
        current.cell === next.cell &&
        current.gap === next.gap &&
        current.height === next.height &&
        current.scale === next.scale
          ? current
          : next,
      );
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(frame);
    observer.observe(grid);

    return () => {
      observer.disconnect();
    };
  }, [columns]);

  return { frameRef, gridRef, metrics };
}
