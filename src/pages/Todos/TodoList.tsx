/** The todo page's working surface: search, filters, groups and bulk actions. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useI18n } from "../../hooks/useI18n";
import { useTags } from "../../hooks/useTags";
import { useTodos } from "../../hooks/useTodos";
import type { Todo, TodoFilter } from "../../types/todo";
import { groupTodos, searchTodos } from "./todos";
import { TodoItem } from "./TodoItem";
import { TodoSearch } from "./TodoSearch";

const FILTERS: readonly TodoFilter[] = ["all", "active", "completed"];

const FILTER_LABELS: Record<TodoFilter, string> = {
  all: "todo.filter.all",
  active: "todo.filter.active",
  completed: "todo.filter.completed",
};

/** The two groups a task can sit in, in the order they are shown. */
const GROUPS = ["active", "completed"] as const;

type Group = (typeof GROUPS)[number];

/** Where a task sat in the last paint: which group, and how far from the top of the window. */
interface Placement {
  group: Group;
  top: number;
}

/** How long a row plays its leaving animation before the task is really taken off the list. */
const LEAVE_MS = 200;

/** How long a task takes to travel to its new place when it changes group. */
const MOVE_MS = 320;

/** How long the row that changed group stays lit once it has landed. */
const SETTLE_MS = 640;

/** The wall clock the relative timestamps are measured against, in the epoch seconds the API uses. */
function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return now;
}

/** Filter switch, the search, the groups themselves and the bulk actions. */
export function TodoList() {
  const { t } = useI18n();
  const {
    counts,
    error,
    filter,
    loading,
    remove,
    rename,
    setFilter,
    todos,
    toggle,
    updateTags,
  } = useTodos();
  const { tags } = useTags();
  const now = useNow();

  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<number>>(() => new Set());

  const visible = useMemo(() => searchTodos(todos, tags, query), [todos, tags, query]);
  const groups = useMemo(() => groupTodos(visible), [visible]);

  /** The row elements by task id, so a task that moved can be measured where it landed. */
  const rowElements = useRef(new Map<number, HTMLLIElement>());
  /** Where each task sat in the last paint, which is the "before" half of the animation below. */
  const placements = useRef(new Map<number, Placement>());

  const placeRow = useCallback((id: number, element: HTMLLIElement | null) => {
    if (element === null) {
      rowElements.current.delete(id);
    } else {
      rowElements.current.set(id, element);
    }
  }, []);

  /**
   * Flips every task that stayed on the page from where it was to where it is now.
   *
   * Tick a task off under the "all" filter and it is not taken off the list at all: it moves into
   * the other group. Comparing where each row sat in the last paint with where it sits here says
   * how far it travelled, and animating that distance away is what sends the row gliding across
   * the divider while the rows it passed slide up to fill the gap it left.
   *
   * A row that is new to the page is skipped: the entrance animation already covers it.
   */
  useLayoutEffect(() => {
    const landed = new Map<number, Placement>();

    GROUPS.forEach((group) => {
      groups[group].forEach((todo) => {
        const element = rowElements.current.get(todo.id);

        if (element !== undefined) {
          landed.set(todo.id, { group, top: element.getBoundingClientRect().top });
        }
      });
    });

    const before = placements.current;

    placements.current = landed;

    if (before.size === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    landed.forEach((last, id) => {
      const first = before.get(id);
      const element = rowElements.current.get(id);

      if (first === undefined || element === undefined) {
        return;
      }

      const distance = first.top - last.top;

      if (Math.abs(distance) > 1) {
        element.animate([{ transform: `translateY(${distance}px)` }, { transform: "none" }], {
          duration: MOVE_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }

      if (first.group !== last.group) {
        // The row stays lit for a moment, so the eye can follow it into its new group.
        element.dataset.settled = "true";

        window.setTimeout(() => {
          delete element.dataset.settled;
        }, SETTLE_MS);
      }
    });
  }, [groups]);

  /** The selected tasks as the store holds them, so a pick made under another filter still works. */
  const chosen = useMemo(() => todos.filter((todo) => selected.has(todo.id)), [todos, selected]);

  /**
   * Marks rows as leaving, then runs the action once the animation has played.
   *
   * The marks come off either way: a row that failed comes back where it was, and a row that only
   * moved between groups comes back to sit in its new one.
   */
  const retire = useCallback((ids: readonly number[], action: () => Promise<boolean>) => {
    setLeaving((current) => new Set([...current, ...ids]));

    window.setTimeout(() => {
      void action().then(() => {
        setLeaving((current) => {
          const next = new Set(current);

          ids.forEach((id) => next.delete(id));

          return next;
        });
      });
    }, LEAVE_MS);
  }, []);

  /**
   * Runs an action that only moves tasks around the page.
   *
   * Under the "all" filter the rows have somewhere to go, so they are left in place and the flip
   * above carries them; under a filter the task leaves the list for good and fades out the way a
   * removed row does.
   */
  const act = useCallback(
    (ids: readonly number[], action: () => Promise<boolean>) => {
      if (filter === "all") {
        void action();
        return;
      }

      retire(ids, action);
    },
    [filter, retire],
  );

  const handleToggle = (todo: Todo): void => {
    act([todo.id], () => toggle(todo));
  };

  const handleRemove = (todo: Todo): void => {
    retire([todo.id], () => remove(todo.id));
  };

  const handleRename = (todo: Todo, title: string): void => {
    void rename(todo.id, title);
  };

  const handleUpdateTags = (todo: Todo, tagIds: readonly number[]): void => {
    void updateTags(todo.id, tagIds);
  };

  const handleSelect = (id: number): void => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const exitSelecting = (): void => {
    setSelecting(false);
    setSelected(new Set());
  };

  const selectEveryVisible = (): void => {
    setSelected(new Set(visible.map((todo) => todo.id)));
  };

  const invertSelection = (): void => {
    setSelected(
      new Set(
        visible
          .map((todo) => todo.id)
          .filter((id) => !selected.has(id)),
      ),
    );
  };

  const completeSelected = (): void => {
    const pending = chosen.filter((todo) => !todo.completed);

    if (pending.length === 0) {
      return;
    }

    act(
      pending.map((todo) => todo.id),
      async () => {
        const done = await Promise.all(pending.map((todo) => toggle(todo)));

        return done.every(Boolean);
      },
    );

    // The pick is spent: leaving it would make the next bulk act on tasks that are already gone.
    setSelected(new Set());
  };

  const deleteSelected = (): void => {
    if (chosen.length === 0) {
      return;
    }

    retire(
      chosen.map((todo) => todo.id),
      async () => {
        const done = await Promise.all(chosen.map((todo) => remove(todo.id)));

        return done.every(Boolean);
      },
    );

    setSelected(new Set());
  };

  const emptyMessage =
    query === ""
      ? counts.total === 0
        ? t("todo.empty")
        : t("todo.filter.empty")
      : t("todo.search.empty", { query });

  return (
    <section className="todo-panel">
      <div className="todo-toolbar">
        <TodoSearch onChange={setQuery} query={query} />
        <SegmentedControl
          label={t("todo.filter.label")}
          onChange={setFilter}
          options={FILTERS.map((value) => ({ label: t(FILTER_LABELS[value]), value }))}
          value={filter}
        />
        <button
          aria-pressed={selecting}
          className="btn btn-quiet"
          onClick={() => {
            if (selecting) {
              exitSelecting();
            } else {
              setSelecting(true);
            }
          }}
          type="button"
        >
          {selecting ? t("todo.select.exit") : t("todo.select.enter")}
        </button>
        <span className="todo-count">
          {query === ""
            ? t("todo.remaining", { remaining: counts.remaining })
            : t("todo.search.results", { count: visible.length })}
        </span>
      </div>

      {selecting ? (
        <div className="todo-bulk">
          <span className="todo-bulk-count">{t("todo.select.count", { count: selected.size })}</span>
          <div className="todo-bulk-actions">
            <button className="btn btn-quiet" onClick={selectEveryVisible} type="button">
              {t("todo.select.all")}
            </button>
            <button className="btn btn-quiet" onClick={invertSelection} type="button">
              {t("todo.select.invert")}
            </button>
            <button
              className="btn"
              disabled={selected.size === 0}
              onClick={completeSelected}
              type="button"
            >
              {t("todo.select.complete")}
            </button>
            <button
              className="btn btn-danger"
              disabled={selected.size === 0}
              onClick={deleteSelected}
              type="button"
            >
              {t("todo.select.delete")}
            </button>
          </div>
          <button className="todo-bulk-exit" onClick={exitSelecting} type="button">
            {t("todo.select.exit")}
          </button>
        </div>
      ) : null}

      {error !== null ? <p className="todo-error">{t("todo.error")}</p> : null}

      {loading ? (
        <p className="muted">{t("todo.loading")}</p>
      ) : visible.length === 0 ? (
        <div className="empty todo-empty">
          <span aria-hidden="true" className="todo-empty-icon">
            <svg viewBox="0 0 24 24">
              <path d="M9 5h6M7 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
              <path d="m9.5 12 2 2 3.5-4" />
            </svg>
          </span>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="todo-groups">
          {GROUPS.map((group) => {
            const rows = groups[group];

            if (rows.length === 0) {
              return null;
            }

            return (
              <section className="todo-group" key={group}>
                <h2 className="todo-group-head">
                  {t(`todo.group.${group}`)}
                  <span className="todo-group-count">{rows.length}</span>
                </h2>
                <ul className="todo-list">
                  {rows.map((todo, index) => (
                    <TodoItem
                      key={todo.id}
                      /* A task the last paint did not have is arriving; one it did have is moving. */
                      entering={!placements.current.has(todo.id)}
                      leaving={leaving.has(todo.id)}
                      now={now}
                      onRemove={handleRemove}
                      onRename={handleRename}
                      onRowRef={placeRow}
                      onSelect={handleSelect}
                      onToggle={handleToggle}
                      onUpdateTags={handleUpdateTags}
                      rowIndex={index}
                      selected={selected.has(todo.id)}
                      selecting={selecting}
                      tags={tags}
                      todo={todo}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
