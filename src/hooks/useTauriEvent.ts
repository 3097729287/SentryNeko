/** Tauri event subscription wrapper with automatic cleanup on unmount. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

import type { ApiResponse, TestEventPayload } from "../types";

/** Event names the backend pushes; each one is documented in `docs/events.md`. */
export const BACKEND_EVENTS = {
  testEvent: "test-event",
} as const;

/**
 * Runs `handler` for every `event` the backend pushes while the component is mounted.
 *
 * The handler lives in a ref, so an inline closure does not resubscribe on every render, and
 * the subscription is torn down on unmount even when `listen` resolves afterwards. Outside
 * Tauri — a plain `pnpm dev` in a browser — nothing is subscribed.
 */
export function useTauriEvent<T>(event: string, handler: (payload: T) => void): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    void listen<T>(event, (message) => handlerRef.current(message.payload)).then((stop) => {
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
  }, [event]);
}

/**
 * Asks the backend to push one `test-event`; `null` when no backend answers.
 *
 * The command is a diagnostic: it exists so the bus can be exercised from the UI before the
 * real events of T15 arrive.
 */
export async function emitTestEvent(): Promise<ApiResponse<TestEventPayload> | null> {
  if (!isTauri()) {
    return null;
  }

  try {
    return await invoke<ApiResponse<TestEventPayload>>("emit_test_event");
  } catch {
    // Transport-level failure: the caller keeps whatever it showed before.
    return null;
  }
}
