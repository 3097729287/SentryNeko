export type ApiCode =
  | "OK"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATABASE"
  | "IO"
  | "PERMISSION_DENIED"
  | "UNSUPPORTED"
  | "INTERNAL";

export interface ApiResponse<T> {
  code: ApiCode;
  message: string;
  details: string | null;
  data: T | null;
}

export function isOk<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.code === "OK";
}

/** Payload of the `test-event` pushed by `emit_test_event` (T08). */
export interface TestEventPayload {
  /** Rises with every push, so two of them can be told apart. */
  sequence: number;
}

/** Which path a notification delivery took; mirrors `services::notification::Outcome`. */
export type NotificationOutcome = "toast" | "fallback";

/** What a notification was about; the in-app toast picks its copy from this. */
export type NotificationKind = "test" | "pomodoro" | "alarm";

/** Payload of the `notification-fallback` push (T14). */
export interface NotificationFallbackPayload {
  kind: NotificationKind;
  /** Platform message describing why the toast was refused. */
  reason: string;
}
