//! Pomodoro commands: the sessions a phase leaves behind.

use tauri::State;

use crate::db::connection::Db;
use crate::models::pomodoro::{Phase, PomodoroSession};
use crate::services::event_bus::EventBus;
use crate::utils::response::{ApiResponse, ApiResult};

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

/// Closes a session with the seconds actually spent and pushes the closed row.
#[tauri::command]
pub fn finish_pomodoro_session(
    db: State<'_, Db>,
    bus: State<'_, EventBus>,
    id: i64,
    actual_seconds: i64,
) -> ApiResponse<PomodoroSession> {
    finish(&db, &bus, id, actual_seconds).into()
}

/// Lists the sessions, newest first.
#[tauri::command]
pub fn list_pomodoro_sessions(db: State<'_, Db>, limit: i64) -> ApiResponse<Vec<PomodoroSession>> {
    PomodoroSession::list(&db, limit).into()
}

fn finish(db: &Db, bus: &EventBus, id: i64, actual_seconds: i64) -> ApiResult<PomodoroSession> {
    let session = PomodoroSession::finish(db, id, actual_seconds)?;

    // The row is stored either way; a push nobody receives must not fail the command, or the
    // window that closed the session would report an error it cannot act on.
    let _ = bus.emit_pomodoro_finished(&session);

    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use crate::services::event_bus::names;
    use crate::services::event_bus::testing::Recorder;
    use crate::utils::response::ApiCode;

    fn created() -> Db {
        let db = Db::open_in_memory().expect("in-memory database opens");
        schema::ensure(&db).expect("schema is created");
        db
    }

    #[test]
    fn a_finished_session_is_pushed_with_its_row() {
        let db = created();
        let recorder = Recorder::default();
        let bus = EventBus::new(recorder.clone());
        let session = PomodoroSession::start(&db, Phase::Focus, 1_500, None).expect("started");

        let finished = finish(&db, &bus, session.id, 1_500).expect("finished");

        let pushed = recorder.pushed();
        assert_eq!(pushed.len(), 1);
        assert_eq!(pushed[0].0, names::POMODORO_FINISHED);
        assert_eq!(pushed[0].1["id"], serde_json::json!(finished.id));
        assert_eq!(pushed[0].1["actualSeconds"], serde_json::json!(1_500));
    }

    #[test]
    fn an_unknown_session_fails_without_pushing() {
        let db = created();
        let recorder = Recorder::default();
        let bus = EventBus::new(recorder.clone());

        let error = finish(&db, &bus, 404, 10).expect_err("unknown session");

        assert_eq!(error.code(), ApiCode::NotFound);
        assert!(recorder.pushed().is_empty());
    }

    #[test]
    fn a_refused_push_does_not_fail_the_finish() {
        let db = created();
        let bus = EventBus::new(RefusingSink);
        let session = PomodoroSession::start(&db, Phase::Focus, 1_500, None).expect("started");

        let finished = finish(&db, &bus, session.id, 1_200).expect("the row is stored");

        assert_eq!(finished.actual_seconds, Some(1_200));
    }

    struct RefusingSink;

    impl crate::services::event_bus::EventSink for RefusingSink {
        fn emit(&self, event: &str, _payload: serde_json::Value) -> ApiResult<()> {
            Err(crate::utils::response::ApiError::internal(format!(
                "`{event}` was refused"
            )))
        }
    }
}
