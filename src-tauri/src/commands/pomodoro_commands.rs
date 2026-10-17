//! Pomodoro commands: the phase durations and the sessions they produce.

use tauri::State;

use crate::db::connection::Db;
use crate::models::pomodoro::{Phase, PomodoroDurations, PomodoroSession};
use crate::utils::response::ApiResponse;

/// Reads the duration of every phase.
#[tauri::command]
pub fn get_pomodoro_durations(db: State<'_, Db>) -> ApiResponse<PomodoroDurations> {
    PomodoroDurations::load(&db).into()
}

/// Stores the duration of every phase.
#[tauri::command]
pub fn set_pomodoro_durations(
    db: State<'_, Db>,
    durations: PomodoroDurations,
) -> ApiResponse<PomodoroDurations> {
    PomodoroDurations::save(&db, durations).into()
}

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
