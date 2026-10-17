//! Event bus commands: pushing bus events on demand.

use tauri::State;

use crate::services::event_bus::{EventBus, TestEvent};
use crate::utils::response::ApiResponse;

/// Pushes one `test-event`, so the frontend can prove the wiring end to end.
#[tauri::command]
pub fn emit_test_event(bus: State<'_, EventBus>) -> ApiResponse<TestEvent> {
    bus.emit_test_event().into()
}
