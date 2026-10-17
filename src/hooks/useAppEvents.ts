/** Foreground application event hook: the usage ranking of one range. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import type { AppUsage, UsageRange } from "../types/appEvent";
import { usageWindow } from "../types/appEvent";

/** How many applications the ranking shows. */
export const RANKING_LIMIT = 10;

export interface AppUsageState {
  /** Ranked applications, longest first; empty while loading or when nothing was recorded. */
  usage: readonly AppUsage[];
  loading: boolean;
  /** Code of the failed call, `null` while everything is fine. */
  error: ApiCode | null;
}

/**
 * Loads the ranking of `range`, asking the backend again whenever the range changes.
 *
 * The window is computed here because the presets are local-calendar concepts; the backend only
 * clips and merges stored rows inside it.
 */
export function useAppUsage(range: UsageRange): AppUsageState {
  const [state, setState] = useState<AppUsageState>({ error: null, loading: true, usage: [] });

  useEffect(() => {
    let cancelled = false;
    const bounds = usageWindow(range);

    setState((current) => ({ ...current, error: null, loading: true }));

    if (!isTauri()) {
      setState({ error: "UNSUPPORTED", loading: false, usage: [] });
      return;
    }

    void invoke<ApiResponse<AppUsage[]>>("app_usage", { ...bounds, limit: RANKING_LIMIT })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setState(
          isOk(response)
            ? { error: null, loading: false, usage: response.data }
            : { error: response.code, loading: false, usage: [] },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setState({ error: "INTERNAL", loading: false, usage: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  return state;
}
