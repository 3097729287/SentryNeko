/** Focus trend hook: focus time per bucket over the window the chart shows. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import type { HeatmapBucket, HeatmapGranularity } from "../types/heatmap";
import { trendWindow } from "../types/trend";

export interface FocusTrendState {
  /** Buckets oldest first, empty ones included; empty while loading or after a failure. */
  buckets: readonly HeatmapBucket[];
  /** Focus seconds of the whole window, so a caller does not sum them again. */
  totalSeconds: number;
  loading: boolean;
  /** Code of the failed call, `null` while everything is fine. */
  error: ApiCode | null;
}

/**
 * Loads the trend of `granularity`.
 *
 * The trend is the heatmap aggregation over a shorter window, so the two charts can never disagree
 * about which day a phase belongs to.
 */
export function useFocusTrend(granularity: HeatmapGranularity): FocusTrendState {
  const [state, setState] = useState<FocusTrendState>({
    buckets: [],
    error: null,
    loading: true,
    totalSeconds: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const bounds = trendWindow(granularity);

    setState((current) => ({ ...current, error: null, loading: true }));

    if (!isTauri()) {
      setState({ buckets: [], error: "UNSUPPORTED", loading: false, totalSeconds: 0 });
      return;
    }

    void invoke<ApiResponse<HeatmapBucket[]>>("heatmap", { ...bounds, granularity })
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (!isOk(response)) {
          setState({ buckets: [], error: response.code, loading: false, totalSeconds: 0 });
          return;
        }

        setState({
          buckets: response.data,
          error: null,
          loading: false,
          totalSeconds: response.data.reduce((total, bucket) => total + bucket.focusSeconds, 0),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ buckets: [], error: "INTERNAL", loading: false, totalSeconds: 0 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [granularity]);

  return state;
}
