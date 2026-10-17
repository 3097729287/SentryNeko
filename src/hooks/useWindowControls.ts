/** Window controls for the custom title bar: minimize, maximize or restore, and close. */

import { isTauri } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export interface UseWindowControlsResult {
  /** Whether the window fills the screen; picks the maximize or the restore icon. */
  maximized: boolean;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
}

/** Runs a window action; no-op outside Tauri, and a vanishing window is ignored. */
function run(action: () => Promise<void>): void {
  if (!isTauri()) {
    return;
  }

  action().catch(() => undefined);
}

/**
 * Drives the custom title bar. The maximized flag is re-read on every resize, since double-click
 * and Windows shortcuts change it without going through these buttons.
 */
export function useWindowControls(): UseWindowControlsResult {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    const appWindow = getCurrentWindow();
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    const sync = (): void => {
      appWindow.isMaximized().then(setMaximized, () => undefined);
    };

    sync();

    void appWindow.onResized(sync).then((stop) => {
      if (cancelled) {
        stop();
      } else {
        unlisten = stop;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return {
    maximized,
    minimize: () => {
      run(() => getCurrentWindow().minimize());
    },
    toggleMaximize: () => {
      run(() => getCurrentWindow().toggleMaximize());
    },
    close: () => {
      run(() => getCurrentWindow().close());
    },
  };
}
