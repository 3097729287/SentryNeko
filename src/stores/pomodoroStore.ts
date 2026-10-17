/** Pomodoro state store: the running phase, its durations and the session row behind it. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import type { PomodoroDurations, PomodoroPhase, PomodoroSession } from "../types/pomodoro";
import { phaseAfter, phaseSeconds } from "../types/pomodoro";

export interface PomodoroState {
  phase: PomodoroPhase;
  durations: PomodoroDurations;
  /** Epoch milliseconds the running phase ends at; `null` while paused or idle. */
  endsAt: number | null;
  /** Milliseconds left, kept current by `tick`. */
  remainingMs: number;
  /** Row backing the running phase; `null` while nothing is running. */
  sessionId: number | null;
  /** Focus phases finished since the app started, which decides when a long break comes. */
  focusCount: number;
  loading: boolean;
  /** Code of the last failed call, `null` while everything is fine. */
  error: ApiCode | null;
  load: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => void;
  reset: () => Promise<void>;
  saveDurations: (durations: PomodoroDurations) => Promise<boolean>;
  /** Advances the clock; the page calls it on an interval, so render throttling cannot drift it. */
  tick: (now: number) => Promise<void>;
}

/** Applied until the stored durations arrive, so the clock never starts at zero. */
const DEFAULT_DURATIONS: PomodoroDurations = {
  focusSeconds: 25 * 60,
  shortBreakSeconds: 5 * 60,
  longBreakSeconds: 15 * 60,
};

/** Runs a command, answering `UNSUPPORTED` outside Tauri so the UI can react the same way. */
async function request<T>(command: string, args: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  if (!isTauri()) {
    return { code: "UNSUPPORTED", message: command, details: null, data: null };
  }

  return invoke<ApiResponse<T>>(command, args);
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  phase: "focus",
  durations: DEFAULT_DURATIONS,
  endsAt: null,
  remainingMs: DEFAULT_DURATIONS.focusSeconds * 1000,
  sessionId: null,
  focusCount: 0,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });

    const response = await request<PomodoroDurations>("get_pomodoro_durations");

    if (!isOk(response)) {
      set({ loading: false, error: response.code });
      return;
    }

    const { endsAt, phase, remainingMs, sessionId } = get();
    const idle = endsAt === null && sessionId === null;

    set({
      durations: response.data,
      loading: false,
      remainingMs: idle ? phaseSeconds(response.data, phase) * 1000 : remainingMs,
    });
  },

  start: async () => {
    const { endsAt, phase, remainingMs, sessionId } = get();

    if (endsAt !== null) {
      return;
    }

    set({ error: null });

    let id = sessionId;

    if (id === null) {
      // The row is opened once per phase, so a pause and a resume stay inside the same session.
      const response = await request<PomodoroSession>("start_pomodoro_session", {
        phase,
        plannedSeconds: Math.max(1, Math.round(remainingMs / 1000)),
      });

      if (!isOk(response)) {
        set({ error: response.code });
        return;
      }

      id = response.data.id;
    }

    set({ endsAt: Date.now() + get().remainingMs, sessionId: id });
  },

  pause: () => {
    const { endsAt } = get();

    if (endsAt === null) {
      return;
    }

    set({ endsAt: null, remainingMs: Math.max(0, endsAt - Date.now()) });
  },

  reset: async () => {
    const { durations, phase, remainingMs, sessionId } = get();
    const totalMs = phaseSeconds(durations, phase) * 1000;
    const spent = Math.max(0, Math.round((totalMs - remainingMs) / 1000));

    set({ error: null, endsAt: null, remainingMs: totalMs });

    if (sessionId === null) {
      return;
    }

    set({ sessionId: null });

    const response = await request<PomodoroSession>("finish_pomodoro_session", {
      actualSeconds: spent,
      id: sessionId,
    });

    if (!isOk(response)) {
      set({ error: response.code });
    }
  },

  saveDurations: async (durations) => {
    set({ error: null });

    const response = await request<PomodoroDurations>("set_pomodoro_durations", { durations });

    if (!isOk(response)) {
      set({ error: response.code });
      return false;
    }

    const { endsAt, phase, sessionId } = get();
    const idle = endsAt === null && sessionId === null;

    set({
      durations: response.data,
      remainingMs: idle ? phaseSeconds(response.data, phase) * 1000 : get().remainingMs,
    });

    return true;
  },

  tick: async (now) => {
    const { endsAt } = get();

    if (endsAt === null) {
      return;
    }

    const left = endsAt - now;

    if (left > 0) {
      set({ remainingMs: left });
      return;
    }

    const { durations, focusCount, phase, sessionId } = get();

    // The phase ran to its end, so the stored row records the full planned length.
    if (sessionId !== null) {
      const response = await request<PomodoroSession>("finish_pomodoro_session", {
        actualSeconds: phaseSeconds(durations, phase),
        id: sessionId,
      });

      if (!isOk(response)) {
        set({ error: response.code });
      }
    }

    const finishedFocus = phase === "focus" ? focusCount + 1 : focusCount;
    const next = phaseAfter(phase, finishedFocus);

    set({
      endsAt: null,
      focusCount: finishedFocus,
      phase: next,
      remainingMs: phaseSeconds(durations, next) * 1000,
      sessionId: null,
    });
  },
}));
