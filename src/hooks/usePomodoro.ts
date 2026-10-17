/** Pomodoro hook: timer state and the actions that drive it. */

import { usePomodoroStore } from "../stores/pomodoroStore";
import type { PomodoroState } from "../stores/pomodoroStore";

/** Timer state and actions for a component; the page decides when to load. */
export function usePomodoro(): PomodoroState {
  return usePomodoroStore();
}
