/** A single todo row: toggle, edit and delete actions. */

import { useState } from "react";

import { useI18n } from "../hooks/useI18n";
import { useTodos } from "../hooks/useTodos";
import type { Todo } from "../types/todo";

/** Shows one task; clicking the title turns it into a field. */
export function TodoItem({ todo }: { todo: Todo }) {
  const { t } = useI18n();
  const { rename, remove, toggle } = useTodos();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const title = draft?.trim() ?? "";
    setDraft(null);

    if (title !== "" && title !== todo.title) {
      void rename(todo.id, title);
    }
  };

  return (
    <li className="todo-item" data-completed={todo.completed}>
      <input
        aria-label={t("todo.toggle")}
        checked={todo.completed}
        className="todo-check"
        onChange={() => {
          void toggle(todo);
        }}
        type="checkbox"
      />
      {draft === null ? (
        <button
          className="todo-title"
          onClick={() => {
            setDraft(todo.title);
          }}
          type="button"
        >
          {todo.title}
        </button>
      ) : (
        <input
          aria-label={t("todo.edit")}
          autoFocus
          className="todo-input todo-input-inline"
          onBlur={commit}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }

            if (event.key === "Escape") {
              setDraft(null);
            }
          }}
          value={draft}
        />
      )}
      <button
        aria-label={t("todo.delete")}
        className="todo-delete"
        onClick={() => {
          void remove(todo.id);
        }}
        title={t("todo.delete")}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 10 10">
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </button>
    </li>
  );
}
