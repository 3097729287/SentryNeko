/** Foreground application events pushed by the collector. */

import { create } from "zustand";

import type { AppEvent } from "../types/appEvent";

/** How many pushes the live tail keeps; the paged history reads the database instead. */
export const LIVE_EVENT_LIMIT = 20;

interface AppEventState {
  /** Latest switches, newest first. */
  live: readonly AppEvent[];
  /** Prepends one push, ignoring a row that is already in the tail. */
  record: (event: AppEvent) => void;
}

export const useAppEventStore = create<AppEventState>((set) => ({
  live: [],
  record: (event) => {
    set((state) =>
      state.live.some((known) => known.id === event.id)
        ? state
        : { live: [event, ...state.live].slice(0, LIVE_EVENT_LIMIT) },
    );
  },
}));
