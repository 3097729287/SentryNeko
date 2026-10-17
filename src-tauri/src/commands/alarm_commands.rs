//! Alarm commands: the list the alarms page maintains.
//!
//! Nothing here fires an alarm: `services/scheduler.rs` watches the same rows from its own thread,
//! so the window only has to keep them right.

use tauri::State;

use crate::db::connection::Db;
use crate::models::alarm::Alarm;
use crate::utils::response::ApiResponse;

/// Lists every alarm, earliest time of day first.
#[tauri::command]
pub fn list_alarms(db: State<'_, Db>) -> ApiResponse<Vec<Alarm>> {
    Alarm::list(&db).into()
}

/// Stores an enabled alarm; `repeatDays` is a weekday mask, `0` for a one-off.
#[tauri::command]
pub fn add_alarm(
    db: State<'_, Db>,
    label: String,
    hour: i64,
    minute: i64,
    repeat_days: i64,
) -> ApiResponse<Alarm> {
    Alarm::add(&db, &label, hour, minute, repeat_days).into()
}

/// Replaces the label, the time and the repeat days of an alarm, keeping it on or off.
#[tauri::command]
pub fn update_alarm(
    db: State<'_, Db>,
    id: i64,
    label: String,
    hour: i64,
    minute: i64,
    repeat_days: i64,
) -> ApiResponse<Alarm> {
    Alarm::update(&db, id, &label, hour, minute, repeat_days).into()
}

/// Switches an alarm on or off.
#[tauri::command]
pub fn set_alarm_enabled(db: State<'_, Db>, id: i64, enabled: bool) -> ApiResponse<Alarm> {
    Alarm::set_enabled(&db, id, enabled).into()
}

/// Deletes an alarm.
#[tauri::command]
pub fn delete_alarm(db: State<'_, Db>, id: i64) -> ApiResponse<()> {
    Alarm::delete(&db, id).into()
}
