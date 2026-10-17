# Tauri commands

**English** | [简体中文](commands.zh-CN.md)

Every frontend ↔ backend call goes through a `#[tauri::command]` function in
`src-tauri/src/commands/`. Handlers stay thin: validate the arguments, delegate to
`services/` or `db/`, and map the outcome to `utils::response`. Business logic does
not live in a command.

## Response envelope

Commands do not return domain types directly. Each one resolves to the same shape,
for success and failure alike (`src-tauri/src/utils/response.rs`, mirrored by
`ApiResponse<T>` in `src/types/index.ts`):

```json
// success
{ "code": "OK", "message": "OK", "details": null, "data": { "id": 1, "title": "Write the docs" } }

// failure
{ "code": "INVALID_INPUT", "message": "title must not be empty", "details": null, "data": null }
```

- `code` — the contract. The frontend switches on it and picks localized copy.
- `message` — fallback copy from the backend, useful for logs and for codes the
  frontend does not know yet. Never the only source of user-visible text.
- `details` — the underlying diagnostic (I/O message, parse error). Surfaced for
  logs and bug reports; not localized and not to be rendered as UI copy.
- `data` — the payload on success, `null` on failure.

The envelope is resolved, not rejected: `invoke()` only rejects on transport-level
failures (command not registered, handler panicked, payload failed to serialize),
so a single `code` check covers every business outcome.

## Error codes

| Code | Meaning | Raised by |
| --- | --- | --- |
| `OK` | Success, `data` present | — |
| `INVALID_INPUT` | Arguments failed validation | Any command validating its input |
| `NOT_FOUND` | Requested record does not exist | CRUD commands (T10, T16, T17) |
| `CONFLICT` | Clashes with stored state (duplicate key, stale revision) | CRUD commands |
| `DATABASE` | Database layer failed | `db/` (T04) |
| `IO` | Filesystem or OS-level I/O failed | `config.rs`, export/import (T29) |
| `PERMISSION_DENIED` | The OS refused the operation | Collector (T12), auto-start (T26) |
| `UNSUPPORTED` | Reserved capability of a later milestone | P3 stubs (T27–T32) |
| `INTERNAL` | Anything unexpected; `details` explains it | Fallback for `?` |

`services::i18n` (T06) maps codes to localized `message` text. Adding a code means
updating both `ApiCode` and the `ApiCode` union in `src/types/index.ts`.

## Writing a command

```rust
// src-tauri/src/commands/todo_commands.rs
use crate::utils::response::{ApiError, ApiResponse, ApiResult};

#[tauri::command]
pub fn toggle_todo(id: i64) -> ApiResponse<Todo> {
    toggle(id).into()
}

fn toggle(id: i64) -> ApiResult<Todo> {
    if id <= 0 {
        return Err(ApiError::invalid_input("id must be a positive integer"));
    }

    repository::toggle_todo(id) // -> ApiResult<Todo>
}
```

Rules (also enforced by `CONTRIBUTING.md`):

1. The public handler returns `ApiResponse<T>`; fallible helpers return
   `ApiResult<T>` and convert once with `.into()`.
2. No `unwrap()` / `expect()` on a path a user can trigger — return an `ApiError`.
3. Need the value inside an envelope? Use `?` on `ApiResult` and convert at the end.
4. Register the handler in `lib.rs` with
   `.invoke_handler(tauri::generate_handler![toggle_todo])`.
5. App-defined commands need no `capabilities/default.json` entry; that file only
   grants permissions of core and plugin commands.
6. Add a row to the table below and update it whenever a signature changes.

## Command index

No commands are registered yet — the first one arrives with T04/T05, and every
command added from then on is listed here.

| Command | Module | Arguments | Returns | Task |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |
