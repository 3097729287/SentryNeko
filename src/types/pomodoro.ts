/** Pomodoro phase and session types mirrored from `models/pomodoro.rs`. */

export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

/** Durations in seconds, as the backend stores them. */
export interface PomodoroDurations {
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
}

export interface PomodoroSession {
  id: number;
  phase: PomodoroPhase;
  plannedSeconds: number;
  actualSeconds: number | null;
  /** UTC epoch seconds. */
  startedAt: number;
  endedAt: number | null;
  todoId: number | null;
}

/** The key of `PomodoroDurations` that holds the length of one phase. */
const DURATION_KEYS: Record<PomodoroPhase, keyof PomodoroDurations> = {
  focus: "focusSeconds",
  shortBreak: "shortBreakSeconds",
  longBreak: "longBreakSeconds",
};

/** How long one phase lasts, in seconds. */
export function phaseSeconds(durations: PomodoroDurations, phase: PomodoroPhase): number {
  return durations[DURATION_KEYS[phase]];
}

/** Focus phases per cycle before the long break takes over. */
export const PHASES_PER_CYCLE = 4;

/**
 * The phase that follows a finished one: a focus phase leads to a break — long on every fourth —
 * and any break leads back to focus.
 */
export function phaseAfter(phase: PomodoroPhase, finishedFocus: number): PomodoroPhase {
  if (phase !== "focus") {
    return "focus";
  }

  return finishedFocus % PHASES_PER_CYCLE === 0 ? "longBreak" : "shortBreak";
}
