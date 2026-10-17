/** Todo task types mirrored from `models/todo.rs`. */

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  /** UTC epoch seconds. */
  createdAt: number;
  updatedAt: number;
}

/** Totals shown beside the list. */
export interface TodoCounts {
  total: number;
  remaining: number;
  completed: number;
}

/** Which tasks the page shows; `list_todos` takes the same three states. */
export type TodoFilter = "all" | "active" | "completed";
