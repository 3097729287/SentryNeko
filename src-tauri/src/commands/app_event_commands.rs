//! Foreground application event query commands.

use tauri::State;

use crate::db::connection::Db;
use crate::models::app_event::{AppEvent, AppUsage};
use crate::utils::response::{ApiResponse, ApiResult};
use crate::utils::time;

/// Ranks the applications by the seconds they held the foreground inside `[from, to)`.
#[tauri::command]
pub fn app_usage(db: State<'_, Db>, from: i64, to: i64, limit: i64) -> ApiResponse<Vec<AppUsage>> {
    usage(&db, from, to, limit).into()
}

fn usage(db: &Db, from: i64, to: i64, limit: i64) -> ApiResult<Vec<AppUsage>> {
    // A window reaching into the future would charge the open row for time that has not happened
    // yet, so the end is cut at the present.
    AppEvent::usage(db, from, to.min(time::now_seconds()), limit)
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
    fn the_window_is_cut_at_the_present() {
        let db = created();
        let now = time::now_seconds();
        AppEvent::open(&db, "code", None, now - 60).expect("opened");

        let usage = usage(&db, now - 3_600, now + 3_600, 10).expect("ranking");

        // Without the cut the open row would answer an hour plus the hour still to come.
        assert!(usage[0].seconds <= 61, "{usage:?}");
    }

    #[test]
    fn an_empty_window_is_refused() {
        let db = created();

        let error = usage(&db, 100, 100, 10).expect_err("empty window");

        assert_eq!(error.code(), ApiCode::InvalidInput);
    }
}
