//! Heatmap commands: focus time and completed tasks per bucket.

use tauri::State;

use crate::db::connection::Db;
use crate::models::heatmap::{Granularity, HeatmapBucket};
use crate::utils::response::ApiResponse;

/// Aggregates focus time and completed tasks per local day, week or month.
#[tauri::command]
pub fn heatmap(
    db: State<'_, Db>,
    from: i64,
    to: i64,
    granularity: Granularity,
) -> ApiResponse<Vec<HeatmapBucket>> {
    crate::models::heatmap::load(&db, from, to, granularity).into()
}
