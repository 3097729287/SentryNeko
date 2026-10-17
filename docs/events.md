# Tauri events

**English** | [简体中文](events.zh-CN.md)

Commands are calls the frontend makes; events are pushes the backend makes. Every event
listed here is emitted through `services/event_bus.rs`: collectors and timers hand their
payloads to the bus, and the bus pushes them to the webview.

## Listening from the frontend

Do not call `listen` directly. `hooks/useTauriEvent.ts` owns the subscription and tears it
down on unmount; outside Tauri it subscribes to nothing, so a plain `pnpm dev` in a browser
still runs.

```tsx
import { BACKEND_EVENTS, useTauriEvent } from "../hooks/useTauriEvent";
import type { TestEventPayload } from "../types";

useTauriEvent<TestEventPayload>(BACKEND_EVENTS.testEvent, (payload) => {
  // payload.sequence
});
```

Event names live in `BACKEND_EVENTS` (`hooks/useTauriEvent.ts`) and payload types in
`src/types/`; both are registered in the table below.

## Event names

Names are flat kebab-case strings. Renaming one breaks every listener, so a rename counts as
a new event: add the new name, migrate the listeners, then drop the old one.

| Event | Payload | Trigger | Task |
| --- | --- | --- | --- |
| `test-event` | `TestEvent` — `{ sequence: u64 }` | `emit_test_event` pushes one on demand; `sequence` rises with every push | T08 |
| `notification-fallback` | `NotificationFallback` — `{ kind, reason }` | `send_test_notification` pushes one when the system refuses the toast, so the frontend paints it in the app instead | T14 |

## Payload rules

- The payload is a `serde` struct next to its name in `services/event_bus.rs` and an interface
  in `src/types/index.ts`; a field is optional only when the type says so.
- Property names are camelCase on the wire (`#[serde(rename_all = "camelCase")]`), so the
  frontend reads `startedAt` rather than `started_at`.
- Timestamps travel as UTC epoch seconds, matching `docs/database.md`, and are formatted for
  display on the frontend; a pre-formatted local string never travels in a payload.
- No localized copy in a payload: the frontend renders its own `t()` keys.
