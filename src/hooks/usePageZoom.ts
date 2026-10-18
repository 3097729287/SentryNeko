/**
 * Page zoom: the reading column widens with the window up to the width the stylesheet names as the
 * design width, and every pixel past that is spent on scaling the whole page up instead — up to a
 * ceiling — so a wide window shows the same page a little larger, in all of its proportions, rather
 * than a longer line of cards.
 *
 * The room to draw in comes from the scroll container's `clientWidth`, and the container is watched
 * rather than the window so a rail that folds — and hands its room back to the page — counts as a
 * resize.
 */

import { useLayoutEffect } from "react";
import type { RefObject } from "react";

/** The most a very wide window may enlarge the page. */
const MAX_ZOOM = 1.2;

/** Used only if the stylesheet does not name a design width. */
const FALLBACK_DESIGN_WIDTH = 1280;

/** How much larger than 1 a page with `available` pixels to draw in should be drawn. */
export function pageZoom(available: number, designWidth: number): number {
  const design = designWidth > 0 ? designWidth : FALLBACK_DESIGN_WIDTH;

  if (available <= design) {
    return 1;
  }

  return Math.min(MAX_ZOOM, available / design);
}

/** Writes the zoom for the page as `--page-zoom` on `containerRef`, and keeps it in step. */
export function usePageZoom(containerRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    // The design width is a constant of the stylesheet, so it is read once. Dragging a window edge
    // fires this on every frame, and asking for computed style that often is itself enough to make
    // the column re-lay-out while the window is still moving.
    const design = Number.parseFloat(
      getComputedStyle(container).getPropertyValue("--page-base-width"),
    );

    const sync = (): void => {
      const zoom = String(pageZoom(container.clientWidth, design));

      // Written only when it changed: the column carries `zoom`, so every write lays the whole page
      // out again, and a window dragged around below the design width never changes the answer.
      if (container.style.getPropertyValue("--page-zoom") !== zoom) {
        container.style.setProperty("--page-zoom", zoom);
      }
    };

    // Measured before the first paint, so the page is never drawn at the wrong size for a frame.
    sync();

    const observer = new ResizeObserver(sync);

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);
}
