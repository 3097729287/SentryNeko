//! Pomodoro commands: the sessions a phase leaves behind.

use tauri::State;

use crate::db::connection::Db;
use crate::models::pomodoro::{Phase, PomodoroSession};
use crate::utils::response::ApiResponse;

/// Opens a session when a phase starts.
#[tauri::command]
pub fn start_pomodoro_session(
    db: State<'_, Db>,
    phase: Phase,
    planned_seconds: i64,
    todo_id: Option<i64>,
) -> ApiResponse<PomodoroSession> {
    PomodoroSession::start(&db, phase, planned_seconds, todo_id).into()
}

/// Closes a session with the seconds actually spent.
#[tauri::command]
pub fn finish_pomodoro_session(
    db: State<'_, Db>,
    id: i64,
    actual_seconds: i64,
) -> ApiResponse<PomodoroSession> {
    PomodoroSession::finish(&db, id, actual_seconds).into()
}

/// Lists the sessions, newest first.
#[tauri::command]
pub fn list_pomodoro_sessions(db: State<'_, Db>, limit: i64) -> ApiResponse<Vec<PomodoroSession>> {
    PomodoroSession::list(&db, limit).into()
}
