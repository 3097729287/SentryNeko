/** Todo data access hook: list, filter and mutate todo tasks. */

import { useTodoStore } from "../stores/todoStore";
import type { TodoState } from "../stores/todoStore";

/** Todo state and actions for a component; the page decides when to load. */
export function useTodos(): TodoState {
  return useTodoStore();
}
