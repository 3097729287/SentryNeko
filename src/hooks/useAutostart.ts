/** Auto-start hook: whether Windows launches the app when the user signs in. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";

export interface AutostartState {
  /** Whether the login entry is in force. */
  enabled: boolean;
  loading: boolean;
  /** Code of the last failed call, `null` while everything is fine. */
  error: ApiCode | null;
  /** Switches the login entry on or off; a refused write leaves the switch where it was. */
  setEnabled: (enabled: boolean) => Promise<void>;
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

/** Reads the login entry once and keeps the switch on what the backend reports afterwards. */
export function useAutostart(): AutostartState {
  const [enabled, setSwitched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCode | null>(null);

  const reload = useCallback(async () => {
    const response = await request<boolean>("get_autostart");

    if (isOk(response)) {
      setSwitched(response.data);
      setError(null);
    } else {
      setError(response.code);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setEnabled = useCallback(async (next: boolean) => {
    const response = await request<boolean>("set_autostart", { enabled: next });

    if (!isOk(response)) {
      setError(response.code);
      return;
    }

    setSwitched(response.data);
    setError(null);
  }, []);

  return { enabled, error, loading, setEnabled };
}
