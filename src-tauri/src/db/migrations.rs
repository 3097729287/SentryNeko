//! Schema creation and versioned migrations.

use crate::db::connection::Db;
use crate::db::repository;
use crate::utils::response::ApiResult;

/// One schema step; `sql` runs once, inside a transaction.
pub struct Migration {
    pub version: u32,
    pub name: &'static str,
    pub sql: &'static str,
}

/// Tables owned by the schema, in creation order.
pub const TABLES: [&str; 5] = [
    "todos",
    "pomodoro_sessions",
    "app_events",
    "alarms",
    "settings",
];

const INITIAL_SCHEMA: &str = r"
CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phase           TEXT    NOT NULL CHECK (phase IN ('focus', 'short_break', 'long_break')),
    planned_seconds INTEGER NOT NULL,
    actual_seconds  INTEGER,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    todo_id         INTEGER REFERENCES todos (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name     TEXT    NOT NULL,
    window_title TEXT,
    started_at   INTEGER NOT NULL,
    ended_at     INTEGER
);

CREATE TABLE IF NOT EXISTS alarms (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL DEFAULT '',
    hour        INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
    minute      INTEGER NOT NULL CHECK (minute BETWEEN 0 AND 59),
    repeat_days INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT    PRIMARY KEY,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_completed
    ON todos (completed, created_at);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at
    ON pomodoro_sessions (started_at);

CREATE INDEX IF NOT EXISTS idx_app_events_started_at
    ON app_events (started_at);
";

/// Append-only history; never edit a shipped entry, add a new version instead.
pub const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "initial_schema",
    sql: INITIAL_SCHEMA,
}];

/// Version a fully migrated database reports.
pub fn latest_version() -> u32 {
    MIGRATIONS.last().map_or(0, |migration| migration.version)
}

/// Applies every pending migration and returns the resulting schema version.
pub fn migrate(db: &Db) -> ApiResult<u32> {
    let applied = current_version(db)?;

    for migration in MIGRATIONS
        .iter()
        .filter(|migration| migration.version > applied)
    {
        repository::transaction(db, |transaction| {
            transaction.execute_batch(migration.sql)?;
            transaction.pragma_update(None, "user_version", migration.version)?;
            Ok(())
        })?;
    }

    Ok(latest_version().max(applied))
}

/// Schema version recorded in the database file (`PRAGMA user_version`).
pub fn current_version(db: &Db) -> ApiResult<u32> {
    let connection = db.connection()?;
    let version =
        connection.pragma_query_value(None, "user_version", |row| row.get::<_, u32>(0))?;

    Ok(version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::Db;
    use crate::utils::response::{ApiCode, ApiError};

    fn migrated() -> Db {
        let db = Db::open_in_memory().expect("in-memory database opens");
        migrate(&db).expect("schema migrates");
        db
    }

    #[test]
    fn versions_start_at_one_and_only_move_forward() {
        let mut previous = 0;

        for migration in MIGRATIONS {
            assert_eq!(
                migration.version,
                previous + 1,
                "{} skips a version",
                migration.name
            );
            assert!(
                !migration.sql.trim().is_empty(),
                "{} has no sql",
                migration.name
            );
            previous = migration.version;
        }

        assert_eq!(latest_version(), previous);
    }

    #[test]
    fn migrate_creates_every_table_and_is_idempotent() {
        let db = Db::open_in_memory().expect("in-memory database opens");

        assert_eq!(migrate(&db).expect("first run"), latest_version());
        assert_eq!(migrate(&db).expect("second run"), latest_version());
        assert_eq!(current_version(&db).expect("version"), latest_version());

        let connection = db.connection().expect("connection");
        for table in TABLES {
            let found: u32 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |row| row.get(0),
                )
                .expect("sqlite_master is readable");
            assert_eq!(found, 1, "{table} is missing");
        }
    }

    #[test]
    fn foreign_keys_are_enforced() {
        let db = migrated();

        let error = db
            .connection()
            .expect("connection")
            .execute(
                "INSERT INTO pomodoro_sessions (phase, planned_seconds, started_at, todo_id)
                 VALUES ('focus', 1500, 1, 987654)",
                [],
            )
            .expect_err("an unknown todo_id is rejected");

        assert_eq!(ApiError::from(error).code(), ApiCode::Database);
    }

    fn maintenance_script() -> String {
        std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../scripts/init_db.ps1"
        ))
        .expect("the maintenance script exists")
    }

    fn maintenance_script_sql(script: &str) -> String {
        let start = script.find("@'").expect("the script holds a here-string") + 2;
        let end = script[start..]
            .find("'@")
            .expect("the here-string is closed");

        script[start..start + end].to_owned()
    }

    #[test]
    fn maintenance_script_creates_the_same_schema() {
        let script = maintenance_script();
        let version = format!("PRAGMA user_version = {};", latest_version());
        assert!(
            script.contains(&version),
            "scripts/init_db.ps1 does not record {version}"
        );

        let db = migrated();
        let connection = db.connection().expect("connection");
        connection
            .execute_batch(&maintenance_script_sql(&script))
            .expect("the script's statements run against a migrated database");

        let mut expected = TABLES;
        expected.sort_unstable();

        let mut statement = connection
            .prepare(
                "SELECT name FROM sqlite_master
                 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                 ORDER BY name",
            )
            .expect("the query compiles");
        let actual = statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("the query runs")
            .collect::<Result<Vec<String>, _>>()
            .expect("the rows are readable");

        assert_eq!(actual, expected);
        assert_eq!(current_version(&db).expect("version"), latest_version());
    }
}
