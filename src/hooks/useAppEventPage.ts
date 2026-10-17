/** Event stream hook: the foreground events of the database, a page at a time. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import type { AppEvent, AppEventPage } from "../types/appEvent";

/** How many rows one page holds. */
export const EVENT_PAGE_SIZE = 30;

export interface AppEventPageState {
  /** Newest first; older pages are appended as they arrive. */
  events: readonly AppEvent[];
  hasMore: boolean;
  /** True only while the first page is on its way. */
  loading: boolean;
  loadingMore: boolean;
  /** Code of the failed call, `null` while everything is fine. */
  error: ApiCode | null;
  loadMore: () => void;
}

/** State after a load that answered no rows. */
function failed(error: ApiCode): Omit<AppEventPageState, "loadMore"> {
  return { error, events: [], hasMore: false, loading: false, loadingMore: false };
}

/** Loads the first page on mount and follows up with older ones on demand. */
export function useAppEventPage(): AppEventPageState {
  const [state, setState] = useState<Omit<AppEventPageState, "loadMore">>({
    error: null,
    events: [],
    hasMore: false,
    loading: true,
    loadingMore: false,
  });
  // Id the next page stops before, so the cursor survives the re-renders between pages.
  const oldest = useRef<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    if (!isTauri()) {
      setState(failed("UNSUPPORTED"));
      return;
    }

    void invoke<ApiResponse<AppEventPage>>("list_app_events", {
      before: null,
      limit: EVENT_PAGE_SIZE,
    })
      .then((response) => {
        if (!alive.current) {
          return;
        }

        if (!isOk(response)) {
          setState(failed(response.code));
          return;
        }

        oldest.current = response.data.events.at(-1)?.id ?? null;
        setState({
          error: null,
          events: response.data.events,
          hasMore: response.data.more,
          loading: false,
          loadingMore: false,
        });
      })
      .catch(() => {
        if (alive.current) {
          setState(failed("INTERNAL"));
        }
      });

    return () => {
      alive.current = false;
    };
  }, []);

  const loadMore = (): void => {
    if (!state.hasMore || state.loading || state.loadingMore) {
      return;
    }

    setState((current) => ({ ...current, loadingMore: true }));

    void invoke<ApiResponse<AppEventPage>>("list_app_events", {
      before: oldest.current,
      limit: EVENT_PAGE_SIZE,
    })
      .then((response) => {
        if (!alive.current) {
          return;
        }

        if (!isOk(response)) {
          setState((current) => ({ ...current, error: response.code, loadingMore: false }));
          return;
        }

        oldest.current = response.data.events.at(-1)?.id ?? oldest.current;
        setState((current) => ({
          ...current,
          events: [...current.events, ...response.data.events],
          hasMore: response.data.more,
          loadingMore: false,
        }));
      })
      .catch(() => {
        if (alive.current) {
          setState((current) => ({ ...current, error: "INTERNAL", loadingMore: false }));
        }
      });
  };

  return { ...state, loadMore };
}
