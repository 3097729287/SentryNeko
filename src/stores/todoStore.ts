/** Todo state store: the list, its filter and the remaining count. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import type { Todo, TodoCounts, TodoFilter } from "../types/todo";

export interface TodoState {
  todos: readonly Todo[];
  counts: TodoCounts;
  filter: TodoFilter;
  loading: boolean;
  /** Code of the last failed call, `null` while everything is fine. */
  error: ApiCode | null;
  setFilter: (filter: TodoFilter) => void;
  refresh: () => Promise<void>;
  add: (title: string) => Promise<boolean>;
  rename: (id: number, title: string) => Promise<boolean>;
  toggle: (todo: Todo) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
}

const EMPTY_COUNTS: TodoCounts = { total: 0, remaining: 0, completed: 0 };

/** Maps the UI filter to the `completed` argument the command takes. */
function completionArgument(filter: TodoFilter): boolean | null {
  if (filter === "active") {
    return false;
  }

  if (filter === "completed") {
    return true;
  }

  return null;
}

/** Runs a command, answering `UNSUPPORTED` outside Tauri so the UI can react the same way. */
async function request<T>(command: string, args: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  if (!isTauri()) {
    return { code: "UNSUPPORTED", message: command, details: null, data: null };
  }

  return invoke<ApiResponse<T>>(command, args);
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  counts: EMPTY_COUNTS,
  filter: "all",
  loading: false,
  error: null,

  setFilter: (filter) => {
    set({ filter });
  },

  refresh: async () => {
    set({ loading: true, error: null });

    const list = await request<Todo[]>("list_todos", {
      completed: completionArgument(get().filter),
    });

    if (!isOk(list)) {
      set({ loading: false, error: list.code });
      return;
    }

    const counts = await request<TodoCounts>("todo_counts");

    if (!isOk(counts)) {
      set({ loading: false, error: counts.code });
      return;
    }

    set({ todos: list.data, counts: counts.data, loading: false });
  },

  add: async (title) => {
    set({ error: null });

    const response = await request<Todo>("add_todo", { title });

    if (!isOk(response)) {
      set({ error: response.code });
      return false;
    }

    await get().refresh();
    return true;
  },

  rename: async (id, title) => {
    set({ error: null });

    const response = await request<Todo>("rename_todo", { id, title });

    if (!isOk(response)) {
      set({ error: response.code });
      return false;
    }

    await get().refresh();
    return true;
  },

  toggle: async (todo) => {
    set({ error: null });

    const response = await request<Todo>("set_todo_completed", {
      completed: !todo.completed,
      id: todo.id,
    });

    if (!isOk(response)) {
      set({ error: response.code });
      return false;
    }

    await get().refresh();
    return true;
  },

  remove: async (id) => {
    set({ error: null });

    const response = await request<unknown>("delete_todo", { id });

    // `isOk` cannot narrow a payload typed `null`, so the code is checked directly.
    if (response.code !== "OK") {
      set({ error: response.code });
      return false;
    }

    await get().refresh();
    return true;
  },
}));
