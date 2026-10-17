/** Form for creating a new todo task. */

import { useState } from "react";
import type { FormEvent } from "react";

import { useI18n } from "../hooks/useI18n";
import { useTodos } from "../hooks/useTodos";

/** Stores the typed title and clears the field once it landed. */
export function AddTodoForm() {
  const { t } = useI18n();
  const { add } = useTodos();
  const [title, setTitle] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();

    const trimmed = title.trim();

    if (trimmed === "") {
      return;
    }

    void add(trimmed).then((stored) => {
      if (stored) {
        setTitle("");
      }
    });
  };

  return (
    <form className="todo-form" onSubmit={submit}>
      <input
        aria-label={t("todo.placeholder")}
        className="todo-input"
        onChange={(event) => {
          setTitle(event.target.value);
        }}
        placeholder={t("todo.placeholder")}
        value={title}
      />
      <button className="btn" disabled={title.trim() === ""} type="submit">
        {t("todo.add")}
      </button>
    </form>
  );
}
