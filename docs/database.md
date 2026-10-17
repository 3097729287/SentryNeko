# Database

**English** | [简体中文](database.zh-CN.md)

SQLite through `rusqlite` with an `r2d2` connection pool. One idempotent script creates the
schema — nothing creates tables by hand.

## Layers

| File | Responsibility |
| --- | --- |
| `db/connection.rs` | `Db` handle, pool settings, connection pragmas, `ApiError` mapping |
| `db/schema.rs` | The whole DDL, applied idempotently on every start |
| `db/repository.rs` | Generic CRUD helpers every model builds on |

`Db` is cloned into Tauri managed state at startup, so commands receive it through `State<Db>`:

```rust
let directory = app.path().app_data_dir()?;
let db = Db::open(directory.join(DATABASE_FILE_NAME))?;
schema::ensure(&db)?;
app.manage(db);
```

## Connection

| Setting | Value |
| --- | --- |
| File | `<app data dir>/sentryneko.db` (i.e. `%APPDATA%\com.sentryneko.desktop\sentryneko.db`) unless `config.json` points elsewhere |
| Pool | 4 connections, 5 s checkout timeout |
| Per connection | `foreign_keys = ON`, `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000 ms` |
| Timestamps | UTC epoch seconds |
| Failures | `ApiCode::DATABASE`, with the SQLite message in `details` |

## Configuration

`config.rs` keeps a small JSON file beside the database and creates it on first run:

```json
{
  "databasePath": "C:\\Users\\you\\AppData\\Roaming\\com.sentryneko.desktop\\sentryneko.db",
  "language": "en-US"
}
```

| Field | Meaning | Default |
| --- | --- | --- |
| `databasePath` | SQLite file the application opens | `<app data dir>/sentryneko.db` |
| `language` | Language tag, listed in `docs/i18n.md` | `en-US` |

Rules:

- A relative `databasePath` resolves against the directory holding `config.json`; an absent
  field falls back to its default.
- An unknown `language` tag falls back to `Language::DEFAULT` and leaves the file as it is.
- A file that does not parse is reported as `IO` with the parser message in `details` and is
  never overwritten — fix or delete it by hand to recover.
- Writes land in `config.json.tmp` and are renamed into place, so a crash cannot truncate the file.
- `settings` (the table below) holds user preferences; `config.json` holds what has to be known
  before the database can be opened.

## Schema

The schema holds seven tables:

| Table | Holds | Key columns |
| --- | --- | --- |
| `todos` | Tasks the user maintains | `title`, `completed`, `created_at`, `updated_at`, `tag_ids` |
| `pomodoro_sessions` | One focus or break interval | `phase`, `planned_seconds`, `actual_seconds`, `started_at`, `ended_at`, `todo_id` |
| `app_events` | Foreground application activity | `app_name`, `window_title`, `started_at`, `ended_at` |
| `alarms` | Recurring reminders | `label`, `hour`, `minute`, `repeat_days`, `enabled`, `created_at` |
| `settings` | Key/value application settings | `key`, `value`, `updated_at` |
| `tags` | Tag names a task can carry | `name` (unique, case-insensitive), `created_at` |
| `todo_tags` | Link between a task and a tag | `todo_id`, `tag_id` |

Tags are stored twice on purpose: `todos.tag_ids` is a JSON array of tag ids, so one task row
answers "which tags" without a join, while `todo_tags` is the index the other direction reads —
`idx_todo_tags_tag_id` finds every task carrying a tag. `Todo::set_tags` writes both sides in one
transaction, and `Tag::delete` removes its id from the cache of every task that listed it.

The pomodoro durations are a single `settings` row: key `pomodoro.durations`, value the JSON form
of `PomodoroDurations`. A missing row means the defaults apply.

`app_events` is written by the foreground collector (`collectors/foreground_app.rs`), which samples
the foreground window once a second:

- A row opens on the sample where an app reaches the foreground (`started_at`) and closes on the
  sample where another app takes over (`ended_at`). `ended_at IS NULL` means the row is still
  running — normally only until the application quits, which closes it.
- `app_name` is the executable file name without its extension (`chrome`, `Code`), so one app keeps
  one value across versions and install paths.
- A window title that changes while the same app stays in front updates `window_title` in place.
  One row is one continuous app stretch, so a window that rewrites its caption every second cannot
  flood the table.
- Windows owned by SentryNeko itself are skipped and the row before them is closed: time spent in
  this app is not activity worth recording.
- A sample that finds nothing to attribute — no foreground window, a locked screen, a process that
  cannot be opened — closes the open row the same way.

## Schema creation

`ensure` runs the script in a transaction on every start: a missing table or index is created, an
existing one is left alone. Nothing is versioned, because the app has not shipped — a schema
change is a local rebuild rather than a migration.

## Repository helpers

| Helper | Returns |
| --- | --- |
| `insert` | The new row id |
| `execute` | Number of affected rows |
| `query_one` | One mapped row, or `NOT_FOUND` |
| `query_optional` | One mapped row, or `None` |
| `query_all` | Every mapped row |
| `count` | The first column of the first row as `i64` |
| `exists` | Whether the query matches at least one row |
| `transaction` | The value of `work`, rolled back when `work` fails |

Row mappers are plain `fn(&Row<'_>) -> ApiResult<T>` values (`RowMapper<T>`), so a model
exposes its mapper as an associated function and every helper stays generic.

## scripts/init_db.ps1

Creates the same schema without starting the app:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/init_db.ps1 [-DatabasePath <file>]
```

It needs `sqlite3` on `PATH`; without it the script stops with a message pointing at the app,
which creates the schema on first run either way. Every statement uses `IF NOT EXISTS`, so
running it repeatedly is safe.

A test extracts the SQL from the script and runs it against a created database, asserting that
both sides end up with the same tables.

## Adding a table or a column

1. Add the DDL to `db/schema.rs`.
2. Mirror it in `scripts/init_db.ps1`, with the same `IF NOT EXISTS` guards.
3. Run `cargo test` — the script check fails while the two sides disagree.
4. Rebuild your local database: run `scripts/init_db.ps1` against a fresh file or delete the old
   one. An existing database is not upgraded, since no version has shipped yet.
