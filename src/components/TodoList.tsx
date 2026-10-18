/** Renders the todo list with filter controls and the remaining count. */

import { useI18n } from "../hooks/useI18n";
import { useTodoDisplay } from "../hooks/useTodoDisplay";
import { useTodos } from "../hooks/useTodos";
import type { TodoFilter } from "../types/todo";
import { SegmentedControl } from "./ui/SegmentedControl";
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
  const { mode } = useTodoDisplay();
  const groups = [
    { type: "oneTime", tasks: todos.filter((todo) => todo.recurrence === null) },
    { type: "recurring", tasks: todos.filter((todo) => todo.recurrence !== null) },
  ] as const;

  return (
    <section className="todo-panel">
      <div className="todo-toolbar">
        <SegmentedControl
          label={t("todo.filter.label")}
          onChange={setFilter}
          options={FILTERS.map((value) => ({ label: t(FILTER_LABELS[value]), value }))}
          value={filter}
        />
        <span className="muted">{t("todo.remaining", { remaining: counts.remaining })}</span>
      </div>
      {error !== null && <p className="todo-error">{t("todo.error")}</p>}
      {loading ? (
        <p className="muted">{t("todo.loading")}</p>
      ) : mode === "merged" && todos.length === 0 ? (
        <div className="empty">
          <p>{t("todo.empty")}</p>
        </div>
      ) : mode === "merged" ? (
        <ul className="todo-list">
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      ) : (
        <div className="todo-groups" data-mode={mode}>
          {groups.map(({ type, tasks }) => (
            <section aria-labelledby={`todo-section-${type}`} className="todo-group" key={type}>
              <h2 className="todo-group-heading" id={`todo-section-${type}`}>
                {t(`todo.section.${type}`)}
                <span className="muted">{tasks.length}</span>
              </h2>
              {tasks.length === 0 ? (
                <div className="empty">
                  <p>{t("todo.empty")}</p>
                </div>
              ) : (
                <ul className="todo-list">
                  {tasks.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
