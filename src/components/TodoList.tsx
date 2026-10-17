/** Renders the todo list with filter controls and the remaining count. */

import { useI18n } from "../hooks/useI18n";
import { useTodos } from "../hooks/useTodos";
import type { TodoFilter } from "../types/todo";
import { TodoItem } from "./TodoItem";

const FILTERS: readonly TodoFilter[] = ["all", "active", "completed"];

const FILTER_LABELS: Record<TodoFilter, string> = {
  all: "todo.filter.all",
  active: "todo.filter.active",
  completed: "todo.filter.completed",
};

/** Filter switch, the tasks themselves and how many are left. */
export function TodoList() {
  const { t } = useI18n();
  const { counts, error, filter, loading, setFilter, todos } = useTodos();

  return (
    <section className="todo-panel">
      <div className="todo-toolbar">
        <div className="todo-filters">
          {FILTERS.map((value) => (
            <button
              aria-pressed={filter === value}
              className="todo-filter"
              key={value}
              onClick={() => {
                setFilter(value);
              }}
              type="button"
            >
              {t(FILTER_LABELS[value])}
            </button>
          ))}
        </div>
        <span className="muted">{t("todo.remaining", { remaining: counts.remaining })}</span>
      </div>
      {error !== null && <p className="todo-error">{t("todo.error")}</p>}
      {loading ? (
        <p className="muted">{t("todo.loading")}</p>
      ) : todos.length === 0 ? (
        <div className="empty">
          <p>{t("todo.empty")}</p>
        </div>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
    </section>
  );
}
