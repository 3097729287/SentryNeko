/** Alarm hook: list, create, edit, enable/disable and delete alarms. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import type { Alarm, AlarmDraft } from "../types/alarm";

export interface AlarmState {
  /** Every alarm, earliest time of day first. */
  alarms: readonly Alarm[];
  loading: boolean;
  /** Code of the last failed call, `null` while everything is fine. */
  error: ApiCode | null;
  add: (draft: AlarmDraft) => Promise<boolean>;
  update: (id: number, draft: AlarmDraft) => Promise<boolean>;
  setEnabled: (alarm: Alarm, enabled: boolean) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const EMPTY: readonly Alarm[] = [];

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

/** Loads the list once and keeps it current after every write. */
export function useAlarms(): AlarmState {
  const [alarms, setAlarms] = useState<readonly Alarm[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCode | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    const response = await request<Alarm[]>("list_alarms");

    if (isOk(response)) {
      setAlarms(response.data);
      setError(null);
    } else {
      setAlarms(EMPTY);
      setError(response.code);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const write = useCallback(
    async (command: string, args: Record<string, unknown>): Promise<boolean> => {
      const response = await request<Alarm>(command, args);

      if (!isOk(response)) {
        setError(response.code);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh],
  );

  const add = useCallback(
    (draft: AlarmDraft) =>
      write("add_alarm", {
        hour: draft.hour,
        label: draft.label,
        minute: draft.minute,
        repeatDays: draft.repeatDays,
      }),
    [write],
  );

  const update = useCallback(
    (id: number, draft: AlarmDraft) =>
      write("update_alarm", {
        hour: draft.hour,
        id,
        label: draft.label,
        minute: draft.minute,
        repeatDays: draft.repeatDays,
      }),
    [write],
  );

  const setEnabled = useCallback(
    (alarm: Alarm, enabled: boolean) =>
      write("set_alarm_enabled", { enabled, id: alarm.id }),
    [write],
  );

  const remove = useCallback(
    async (id: number) => {
      const response = await request<unknown>("delete_alarm", { id });

      // `isOk` cannot narrow a payload typed `null`, so the code is checked directly.
      if (response.code !== "OK") {
        setError(response.code);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh],
  );

  return { add, alarms, error, loading, refresh, remove, setEnabled, update };
}
