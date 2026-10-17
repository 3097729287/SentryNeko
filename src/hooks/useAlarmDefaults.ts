/** Alarm defaults hook: the ring duration and notification method every alarm rings with. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import { DEFAULT_ALARM_DEFAULTS } from "../types/alarm";
import type { AlarmDefaults } from "../types/alarm";

export interface AlarmDefaultsState {
  /** The stored defaults, or the built-in ones until they arrive. */
  defaults: AlarmDefaults;
  loading: boolean;
  /** Code of the last failed call, `null` while everything is fine. */
  error: ApiCode | null;
  reload: () => Promise<void>;
  save: (defaults: AlarmDefaults) => Promise<AlarmDefaults | null>;
}

/** Runs a command, answering `UNSUPPORTED` outside Tauri so the UI can react the same way. */
async function request<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<ApiResponse<T>> {
  if (!isTauri()) {
    return { code: "UNSUPPORTED", message: command, details: null, data: null };
  }

  return invoke<ApiResponse<T>>(command, args);
}

/** Reads the defaults once and answers with what the backend stored after a save. */
export function useAlarmDefaults(): AlarmDefaultsState {
  const [defaults, setDefaults] = useState<AlarmDefaults>(DEFAULT_ALARM_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCode | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);

    const response = await request<AlarmDefaults>("get_alarm_defaults");

    if (isOk(response)) {
      setDefaults(response.data);
      setError(null);
    } else {
      setError(response.code);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async (next: AlarmDefaults): Promise<AlarmDefaults | null> => {
    const response = await request<AlarmDefaults>("set_alarm_defaults", { defaults: next });

    if (!isOk(response)) {
      setError(response.code);
      return null;
    }

    // The backend validates the duration, so the answer is the value actually in force.
    setDefaults(response.data);
    setError(null);

    return response.data;
  }, []);

  return { defaults, error, loading, reload, save };
}
