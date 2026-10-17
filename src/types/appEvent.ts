/** Foreground application event types, mirrored from `models/app_event.rs`. */

/** One episode of an application in the foreground; the collector pushes each new one. */
export interface AppEvent {
  id: number;
  /** Executable file name without its extension, e.g. `chrome`. */
  appName: string;
  /** Caption of the window when the app reached the foreground. */
  windowTitle: string | null;
  /** UTC epoch seconds. */
  startedAt: number;
  /** UTC epoch seconds; `null` while the app is still in front. */
  endedAt: number | null;
}
