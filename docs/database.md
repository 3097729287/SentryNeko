# Database

**English** | [简体中文](database.zh-CN.md)

SQLite through `rusqlite` with an `r2d2` connection pool. The schema is created by versioned
migrations — nothing creates tables by hand.

## Layers

| File | Responsibility |
| --- | --- |
| `db/connection.rs` | `Db` handle, pool settings, connection pragmas, `ApiError` mapping |
| `db/migrations.rs` | Versioned DDL guarded by `PRAGMA user_version` |
| `db/repository.rs` | Generic CRUD helpers every model builds on |

`Db` is cloned into Tauri managed state at startup, so commands receive it through `State<Db>`:

```rust
let directory = app.path().app_data_dir()?;
let db = Db::open(directory.join(DATABASE_FILE_NAME))?;
migrations::migrate(&db)?;
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

Version 1 holds five tables:

| Table | Holds | Key columns |
| --- | --- | --- |
| `todos` | Tasks the user maintains | `title`, `completed`, `created_at`, `updated_at` |
| `pomodoro_sessions` | One focus or break interval | `phase`, `planned_seconds`, `actual_seconds`, `started_at`, `ended_at`, `todo_id` |
| `app_events` | Foreground application activity | `app_name`, `window_title`, `started_at`, `ended_at` |
| `alarms` | Recurring reminders | `label`, `hour`, `minute`, `repeat_days`, `enabled`, `created_at` |
| `settings` | Key/value application settings | `key`, `value`, `updated_at` |

## Migrations

`MIGRATIONS` is append-only: a shipped version is never edited, a change arrives as a new
`Migration` with the next `version`. Each one runs in a transaction that also sets
`PRAGMA user_version`, so a crash leaves the database on the last complete version and
re-running `migrate` is a no-op.

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
which migrates on first run either way. Every statement uses `IF NOT EXISTS`, so running it
repeatedly is safe.

A test extracts the SQL from the script and runs it against a migrated database, asserting that
both sides create the same tables and record the same `user_version`.

## Adding a table or a column

1. Append a `Migration` with the next version in `db/migrations.rs`; version 1 stays as shipped.
2. Mirror the DDL in `scripts/init_db.ps1` with the same `IF NOT EXISTS` guards and bump its
   `PRAGMA user_version`.
3. Run `cargo test` — the script check fails while the two sides disagree.
