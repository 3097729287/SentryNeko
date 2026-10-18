/** Dashboard layout: which panel sits where on the cell grid, and how many columns it has. */

/** Panels the dashboard can place, in the order a fresh layout fills them. */
export const DASHBOARD_WIDGETS = [
  "focus",
  "pomodoro",
  "completion",
  "todos",
  "usage",
  "alarm",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];

/** Column counts the layout editor offers. */
export const DASHBOARD_COLUMNS = [2, 3, 4, 5, 6] as const;

export type DashboardColumns = (typeof DASHBOARD_COLUMNS)[number];

/** Columns a fresh layout starts with: wide enough for the focus block, tight enough to stay square-ish. */
export const DEFAULT_COLUMNS: DashboardColumns = 4;

/** A panel's rectangle in cells. */
export interface WidgetPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Every panel's rectangle, so a layout is complete by construction. */
export type DashboardPlacements = Record<DashboardWidgetId, WidgetPlacement>;

export interface DashboardLayout {
  columns: number;
  placements: DashboardPlacements;
  /**
   * Panels taken off the grid and parked in the library.
   *
   * Their rectangles are kept while they are out, so putting one back where it was costs nothing,
   * and a layout that never removed anything is the same as before this list existed.
   */
  hidden: DashboardWidgetId[];
}

/** Smallest rectangle each panel still reads in; the editor refuses to go below it. */
const MIN_SIZE: Record<DashboardWidgetId, { w: number; h: number }> = {
  alarm: { h: 1, w: 2 },
  completion: { h: 1, w: 1 },
  focus: { h: 2, w: 2 },
  pomodoro: { h: 1, w: 1 },
  todos: { h: 1, w: 1 },
  usage: { h: 2, w: 1 },
};

/** Rectangle a panel asks for when a layout is built from scratch. */
const WANTED_SIZE: Record<DashboardWidgetId, { w: number; h: number }> = {
  alarm: { h: 1, w: 3 },
  completion: { h: 1, w: 1 },
  focus: { h: 2, w: 2 },
  pomodoro: { h: 1, w: 1 },
  todos: { h: 1, w: 1 },
  usage: { h: 2, w: 1 },
};

/** Whether two rectangles share at least one cell. */
export function overlaps(a: WidgetPlacement, b: WidgetPlacement): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Smallest rectangle `id` may occupy. */
export function minSizeOf(id: DashboardWidgetId): { w: number; h: number } {
  return MIN_SIZE[id];
}

/** Rectangle `id` asks for when it is dropped onto the grid from the library. */
export function wantedSizeOf(id: DashboardWidgetId): { w: number; h: number } {
  return WANTED_SIZE[id];
}

/** The panels the page actually draws, in the order a fresh layout fills them. */
export function visibleWidgets(layout: DashboardLayout): readonly DashboardWidgetId[] {
  return DASHBOARD_WIDGETS.filter((id) => !layout.hidden.includes(id));
}

/** The panels parked in the library. */
export function hiddenWidgets(layout: DashboardLayout): readonly DashboardWidgetId[] {
  return DASHBOARD_WIDGETS.filter((id) => layout.hidden.includes(id));
}

/** Trims a rectangle so it fits `columns` and keeps the panel's minimum size. */
export function clampPlacement(
  id: DashboardWidgetId,
  placement: WidgetPlacement,
  columns: number,
): WidgetPlacement {
  const min = MIN_SIZE[id];
  const w = Math.max(Math.min(min.w, columns), Math.min(placement.w, columns));
  const h = Math.max(min.h, placement.h);

  return {
    h,
    w,
    x: Math.min(Math.max(0, placement.x), columns - w),
    y: Math.max(0, placement.y),
  };
}

/** First free spot for `size`, scanning rows from the top so the page stays packed. */
function firstFit(
  size: { w: number; h: number },
  placed: readonly WidgetPlacement[],
  columns: number,
): WidgetPlacement {
  let y = 0;

  for (;;) {
    for (let x = 0; x + size.w <= columns; x += 1) {
      const candidate: WidgetPlacement = { h: size.h, w: size.w, x, y };

      if (!placed.some((other) => overlaps(candidate, other))) {
        return candidate;
      }
    }

    y += 1;
  }
}

/** Lays `order` out in that order, keeping every rectangle inside `columns`. */
function arrange(
  order: readonly DashboardWidgetId[],
  sizes: Record<DashboardWidgetId, { w: number; h: number }>,
  columns: number,
): DashboardPlacements {
  const placed: WidgetPlacement[] = [];
  const result = {} as DashboardPlacements;

  for (const id of order) {
    const spot = firstFit(sizes[id], placed, columns);

    result[id] = spot;
    placed.push(spot);
  }

  return result;
}

/**
 * Last free row for `candidate`, given the panels already placed.
 *
 * Panels are pushed straight down instead of shoved sideways, so a drag only displaces what it
 * lands on and never reshuffles the rest of the page.
 */
function dropInto(candidate: WidgetPlacement, placed: readonly WidgetPlacement[]): WidgetPlacement {
  let next = { ...candidate };
  let guard = 0;

  while (placed.some((other) => overlaps(next, other))) {
    next = { ...next, y: next.y + 1 };
    guard += 1;

    // Every panel has a minimum height, so a runaway loop would mean broken input rather than a
    // full board; stop instead of hanging the editor.
    if (guard > 512) {
      break;
    }
  }

  return next;
}

/** Re-flows `placements`, keeping `fixed` exactly where it was put and dropping the rest below it. */
function pack(
  placements: DashboardPlacements,
  columns: number,
  fixed: DashboardWidgetId,
): DashboardPlacements {
  const result = {} as DashboardPlacements;
  const placed: WidgetPlacement[] = [];
  const anchored = clampPlacement(fixed, placements[fixed], columns);

  result[fixed] = anchored;
  placed.push(anchored);

  const rest = DASHBOARD_WIDGETS.filter((id) => id !== fixed).sort(
    (a, b) => placements[a].y - placements[b].y || placements[a].x - placements[b].x,
  );

  for (const id of rest) {
    const next = dropInto(clampPlacement(id, placements[id], columns), placed);

    result[id] = next;
    placed.push(next);
  }

  return result;
}

/** A layout for `columns`: the panels in their wanted sizes, packed from the top left. */
export function defaultLayout(columns: number = DEFAULT_COLUMNS): DashboardLayout {
  const sizes = {} as Record<DashboardWidgetId, { w: number; h: number }>;

  for (const id of DASHBOARD_WIDGETS) {
    sizes[id] = {
      h: WANTED_SIZE[id].h,
      w: Math.max(Math.min(MIN_SIZE[id].w, columns), Math.min(WANTED_SIZE[id].w, columns)),
    };
  }

  return { columns, hidden: [], placements: arrange(DASHBOARD_WIDGETS, sizes, columns) };
}

/** Renders `placements` on `columns` cells, pushing any overlap down. */
export function layoutOf(placements: DashboardPlacements, columns: number): DashboardLayout {
  return {
    columns,
    hidden: [],
    placements: pack(placements, columns, "focus"),
  };
}

/** Puts `id` at `placement` and re-flows the panels it now covers. */
export function moveWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  placement: WidgetPlacement,
): DashboardLayout {
  return {
    ...layout,
    placements: pack({ ...layout.placements, [id]: placement }, layout.columns, id),
  };
}

/**
 * Puts a parked panel back on the grid.
 *
 * Without a rectangle the panel takes the first gap of its wanted size, so the library can offer a
 * one-click add next to the drag; with one, the drop point wins and the panels it covers move down.
 */
export function showWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  placement?: WidgetPlacement,
): DashboardLayout {
  const wanted = wantedSizeOf(id);
  const size = {
    h: Math.max(minSizeOf(id).h, wanted.h),
    w: Math.max(minSizeOf(id).w, Math.min(wanted.w, layout.columns)),
  };
  const spot =
    placement ??
    firstFit(
      size,
      visibleWidgets(layout).map((other) => layout.placements[other]),
      layout.columns,
    );

  return {
    columns: layout.columns,
    hidden: layout.hidden.filter((other) => other !== id),
    placements: pack(
      { ...layout.placements, [id]: clampPlacement(id, { ...spot, ...size }, layout.columns) },
      layout.columns,
      id,
    ),
  };
}

/** Takes `id` off the grid and parks it in the library, remembering its rectangle. */
export function hideWidget(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  if (layout.hidden.includes(id)) {
    return layout;
  }

  return { ...layout, hidden: [...layout.hidden, id] };
}

/** Grows or shrinks `id`; the panels it now covers move down. */
export function resizeWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  size: { w: number; h: number },
): DashboardLayout {
  const current = layout.placements[id];

  return moveWidget(layout, id, { ...current, h: size.h, w: size.w });
}

/**
 * Re-flows the layout onto `columns`, keeping each panel's current size and reading order.
 *
 * Panels keep their place in the sequence rather than their coordinates, so a narrower grid
 * simply wraps them instead of leaving holes on the right.
 */
export function withColumns(layout: DashboardLayout, columns: number): DashboardLayout {
  const order = [...DASHBOARD_WIDGETS].sort(
    (a, b) => layout.placements[a].y - layout.placements[b].y ||
      layout.placements[a].x - layout.placements[b].x,
  );
  const sizes = {} as Record<DashboardWidgetId, { w: number; h: number }>;

  for (const id of DASHBOARD_WIDGETS) {
    const placement = clampPlacement(id, layout.placements[id], columns);

    sizes[id] = { h: placement.h, w: placement.w };
  }

  return { columns, hidden: layout.hidden, placements: arrange(order, sizes, columns) };
}

/** Whether `value` is a layout the app can render. */
export function isDashboardLayout(value: unknown): value is DashboardLayout {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const layout = value as Partial<DashboardLayout>;

  if (
    typeof layout.columns !== "number" ||
    !Number.isInteger(layout.columns) ||
    layout.columns < 2
  ) {
    return false;
  }

  // Layouts saved before the library existed carry no list at all, which is the same as "nothing
  // parked"; anything else has to name real panels.
  if (
    layout.hidden !== undefined &&
    (!Array.isArray(layout.hidden) ||
      !layout.hidden.every((id) => (DASHBOARD_WIDGETS as readonly string[]).includes(id)))
  ) {
    return false;
  }

  if (typeof layout.placements !== "object" || layout.placements === null) {
    return false;
  }

  const placements = layout.placements as Partial<DashboardPlacements>;

  return DASHBOARD_WIDGETS.every((id) => {
    const placement = placements[id];

    if (typeof placement !== "object" || placement === null) {
      return false;
    }

    const cells = placement as unknown as Record<string, unknown>;

    return ["h", "w", "x", "y"].every((key) => {
      const cell = cells[key];

      return typeof cell === "number" && Number.isInteger(cell) && cell >= 0;
    });
  });
}

/**
 * Turns stored JSON into a layout the app can render, or `null` when it cannot.
 *
 * The only gap `isDashboardLayout` tolerates is a missing library list, so plugging it in here
 * keeps every reader dealing with a complete layout.
 */
export function normalizeLayout(value: unknown): DashboardLayout | null {
  if (!isDashboardLayout(value)) {
    return null;
  }

  return { columns: value.columns, hidden: value.hidden ?? [], placements: value.placements };
}
