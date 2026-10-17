//! Foreground application event model: one continuous stretch of one app in the foreground.

use rusqlite::{params, Row};
use serde::Serialize;

use crate::db::connection::Db;
use crate::db::repository;
use crate::utils::response::{ApiError, ApiResult};

/// Columns every query selects, in the order [`AppEvent::from_row`] reads them.
const COLUMNS: &str = "id, app_name, window_title, started_at, ended_at";

/// Processes that paint the lock screen and the sign-in prompt; time there is not usage.
const LOCK_SHELLS: [&str; 2] = ["LockApp", "LogonUI"];

/// Longest ranking the usage query answers with.
const MAX_RANKING: i64 = 50;

/// One `app_events` row.
///
/// A row opens when an app reaches the foreground and closes when another one takes over, so
/// `ended_at` stays `None` for as long as the app stays in front. Windows of the application
/// itself are never recorded.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEvent {
    pub id: i64,
    pub app_name: String,
    pub window_title: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
}

impl AppEvent {
    /// Maps one `app_events` row selected with [`COLUMNS`].
    pub fn from_row(row: &Row<'_>) -> ApiResult<Self> {
        Ok(Self {
            id: row.get(0)?,
            app_name: row.get(1)?,
            window_title: row.get(2)?,
            started_at: row.get(3)?,
            ended_at: row.get(4)?,
        })
    }

    /// Opens a row at `started_at`; the caller supplies the instant it observed the switch.
    pub fn open(
        db: &Db,
        app_name: &str,
        window_title: Option<&str>,
        started_at: i64,
    ) -> ApiResult<Self> {
        let app_name = app_name.trim();

        if app_name.is_empty() {
            return Err(ApiError::invalid_input("appName must not be empty"));
        }

        let id = repository::insert(
            db,
            "INSERT INTO app_events (app_name, window_title, started_at) VALUES (?1, ?2, ?3)",
            params![app_name, window_title, started_at],
        )?;

        Self::find(db, id)
    }

    /// Closes an open row at `ended_at`; a row that is already closed is `NOT_FOUND`.
    pub fn close(db: &Db, id: i64, ended_at: i64) -> ApiResult<Self> {
        let changed = repository::execute(
            db,
            "UPDATE app_events SET ended_at = ?1 WHERE id = ?2 AND ended_at IS NULL",
            params![ended_at, id],
        )?;

        if changed == 0 {
            return Err(AppEvent::missing(id));
        }

        Self::find(db, id)
    }

    /// Replaces the window title of an open row.
    ///
    /// A title change inside the same app — a new browser tab, a document saved under a new
    /// name, a player rewriting its caption every second — updates the row instead of splitting
    /// it, so one row stays one app stretch.
    pub fn retitle(db: &Db, id: i64, window_title: Option<&str>) -> ApiResult<Self> {
        let changed = repository::execute(
            db,
            "UPDATE app_events SET window_title = ?1 WHERE id = ?2 AND ended_at IS NULL",
            params![window_title, id],
        )?;

        if changed == 0 {
            return Err(AppEvent::missing(id));
        }

        Self::find(db, id)
    }

    /// Ranks applications by the seconds they held the foreground inside `[from, to)`.
    ///
    /// The rules, in one place:
    ///
    /// - Every row is clipped to the window, so a stretch that began yesterday only counts the
    ///   part that is inside it.
    /// - Rows of the same application are summed, so an app revisited later in the window is
    ///   merged with its earlier stretch instead of appearing twice.
    /// - A row without `ended_at` is still running and counts up to `to`.
    /// - The lock and sign-in shells are dropped: locked time belongs to nobody.
    /// - The answer is ordered by seconds, longest first, and cut at `limit`.
    pub fn usage(db: &Db, from: i64, to: i64, limit: i64) -> ApiResult<Vec<AppUsage>> {
        if to <= from {
            return Err(ApiError::invalid_input("to must be after from")
                .with_details(format!("received from = {from}, to = {to}")));
        }

        let limit = limit.clamp(1, MAX_RANKING);

        repository::query_all(
            db,
            &format!(
                "SELECT app_name, SUM(MIN(COALESCE(ended_at, ?2), ?2) - MAX(started_at, ?1)) AS seconds
                 FROM app_events
                 WHERE started_at < ?2
                   AND COALESCE(ended_at, ?2) > ?1
                   AND app_name NOT IN (?3, ?4)
                 GROUP BY app_name
                 HAVING seconds > 0
                 ORDER BY seconds DESC, app_name ASC
                 LIMIT {limit}"
            ),
            params![from, to, LOCK_SHELLS[0], LOCK_SHELLS[1]],
            |row| {
                Ok(AppUsage {
                    app_name: row.get(0)?,
                    seconds: row.get(1)?,
                })
            },
        )
    }

    /// Returns one row; a missing id is `NOT_FOUND`.
    pub fn find(db: &Db, id: i64) -> ApiResult<Self> {
        repository::query_one(
            db,
            &format!("SELECT {COLUMNS} FROM app_events WHERE id = ?1"),
            [id],
            Self::from_row,
        )
    }

    fn missing(id: i64) -> ApiError {
        ApiError::not_found(format!("no open app event with id {id}"))
    }
}

/// One line of the usage ranking: an application and the seconds it was in front.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUsage {
    /// Executable file name without its extension, e.g. `chrome`.
    pub app_name: String,
    /// Seconds inside the window, merged over every row of that app.
    pub seconds: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use crate::utils::response::ApiCode;

    fn created() -> Db {
        let db = Db::open_in_memory().expect("in-memory database opens");
        schema::ensure(&db).expect("schema is created");
        db
    }

    #[test]
    fn an_opened_row_stays_open_until_it_is_closed() {
        let db = created();

        let opened = AppEvent::open(&db, "code", Some("main.rs - SentryNeko"), 1_700_000_000)
            .expect("opened");

        assert_eq!(opened.app_name, "code");
        assert_eq!(opened.window_title.as_deref(), Some("main.rs - SentryNeko"));
        assert_eq!(opened.started_at, 1_700_000_000);
        assert_eq!(opened.ended_at, None);

        let closed = AppEvent::close(&db, opened.id, 1_700_000_600).expect("closed");
        assert_eq!(closed.ended_at, Some(1_700_000_600));
        assert_eq!(AppEvent::find(&db, opened.id).expect("found"), closed);
    }

    #[test]
    fn a_closed_row_cannot_be_closed_or_renamed_again() {
        let db = created();
        let opened = AppEvent::open(&db, "chrome", None, 100).expect("opened");
        AppEvent::close(&db, opened.id, 200).expect("closed");

        assert_eq!(
            AppEvent::close(&db, opened.id, 300)
                .expect_err("already closed")
                .code(),
            ApiCode::NotFound
        );
        assert_eq!(
            AppEvent::retitle(&db, opened.id, Some("late"))
                .expect_err("already closed")
                .code(),
            ApiCode::NotFound
        );
    }

    #[test]
    fn renaming_keeps_the_row_and_its_start() {
        let db = created();
        let opened = AppEvent::open(&db, "chrome", Some("tab one"), 100).expect("opened");

        let renamed = AppEvent::retitle(&db, opened.id, Some("tab two")).expect("renamed");

        assert_eq!(renamed.id, opened.id);
        assert_eq!(renamed.window_title.as_deref(), Some("tab two"));
        assert_eq!(renamed.started_at, 100);
        assert_eq!(renamed.ended_at, None);
    }

    #[test]
    fn a_blank_app_name_is_refused() {
        let db = created();

        for blank in ["", "   ", "\t"] {
            let error = AppEvent::open(&db, blank, None, 100).expect_err("blank name is refused");
            assert_eq!(error.code(), ApiCode::InvalidInput);
        }
    }

    #[test]
    fn an_unknown_row_is_not_found() {
        let db = created();

        let error = AppEvent::find(&db, 404).expect_err("unknown row");
        assert_eq!(error.code(), ApiCode::NotFound);
    }

    /// Stores one episode; `ended_at == None` leaves the row open.
    fn episode(db: &Db, app_name: &str, started_at: i64, ended_at: Option<i64>) {
        let opened = AppEvent::open(db, app_name, None, started_at).expect("opened");

        if let Some(ended_at) = ended_at {
            AppEvent::close(db, opened.id, ended_at).expect("closed");
        }
    }

    #[test]
    fn usage_is_clipped_to_the_asked_window() {
        let db = created();
        episode(&db, "code", 0, Some(1_000));
        episode(&db, "chrome", 1_000, Some(2_000));

        let usage = AppEvent::usage(&db, 1_500, 2_500, 10).expect("ranking");

        assert_eq!(
            usage,
            [AppUsage {
                app_name: "chrome".to_owned(),
                seconds: 500,
            }],
            "code ended before the window and chrome only overlaps half of it"
        );
    }

    #[test]
    fn a_revisited_app_is_merged_with_its_earlier_stretch() {
        let db = created();
        episode(&db, "code", 0, Some(100));
        episode(&db, "chrome", 100, Some(200));
        episode(&db, "code", 200, Some(300));

        let usage = AppEvent::usage(&db, 0, 1_000, 10).expect("ranking");

        assert_eq!(
            usage,
            [
                AppUsage {
                    app_name: "code".to_owned(),
                    seconds: 200,
                },
                AppUsage {
                    app_name: "chrome".to_owned(),
                    seconds: 100,
                },
            ]
        );
    }

    #[test]
    fn an_open_row_counts_up_to_the_end_of_the_window() {
        let db = created();
        episode(&db, "code", 0, None);

        let usage = AppEvent::usage(&db, 0, 500, 10).expect("ranking");

        assert_eq!(usage[0].seconds, 500);
    }

    #[test]
    fn the_lock_and_sign_in_shells_are_dropped() {
        let db = created();
        for shell in LOCK_SHELLS {
            episode(&db, shell, 0, Some(1_000));
        }
        episode(&db, "code", 0, Some(400));

        let usage = AppEvent::usage(&db, 0, 1_000, 10).expect("ranking");

        assert_eq!(
            usage,
            [AppUsage {
                app_name: "code".to_owned(),
                seconds: 400,
            }]
        );
    }

    #[test]
    fn the_ranking_is_ordered_and_cut_at_the_limit() {
        let db = created();
        episode(&db, "short", 0, Some(100));
        episode(&db, "long", 0, Some(900));
        episode(&db, "middle", 0, Some(500));

        let usage = AppEvent::usage(&db, 0, 1_000, 2).expect("ranking");

        assert_eq!(
            usage
                .iter()
                .map(|entry| entry.app_name.as_str())
                .collect::<Vec<_>>(),
            ["long", "middle"]
        );
    }

    #[test]
    fn a_window_that_ends_before_it_starts_is_refused() {
        let db = created();

        let error = AppEvent::usage(&db, 500, 500, 10).expect_err("empty window");
        assert_eq!(error.code(), ApiCode::InvalidInput);
    }
}
