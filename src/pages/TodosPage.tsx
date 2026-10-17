/** Todo page. */

import { useEffect } from "react";

import { AddTodoForm } from "../components/AddTodoForm";
import { TodoList } from "../components/TodoList";
import { useI18n } from "../hooks/useI18n";
import { useTodos } from "../hooks/useTodos";

/** Renders the add form, the filters and the tasks. */
export function TodosPage() {
  const { t } = useI18n();
  const { filter, refresh } = useTodos();

  // One load per filter change; the components below only read the result.
  useEffect(() => {
    void refresh();
  }, [filter, refresh]);

  return (
    <>
      <h1>{t("nav.todos")}</h1>
      <AddTodoForm />
      <TodoList />
    </>
  );
}
