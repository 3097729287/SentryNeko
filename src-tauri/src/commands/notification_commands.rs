//! Notification commands: the diagnostic that proves the toast channel works.

use tauri::{AppHandle, State};

use crate::config::Config;
use crate::services::event_bus::EventBus;
use crate::services::notification::{Notification, Notifier, Outcome};
use crate::utils::response::{ApiResponse, ApiResult};

/// Shows a test toast; when the system refuses it, the fallback event reaches the frontend.
#[tauri::command]
pub fn send_test_notification(
    app: AppHandle,
    config: State<'_, Config>,
    bus: State<'_, EventBus>,
) -> ApiResponse<Outcome> {
    show_test(&app, &config, &bus).into()
}

fn show_test(app: &AppHandle, config: &Config, bus: &EventBus) -> ApiResult<Outcome> {
    let language = config.language()?;

    Notifier::new(app.clone()).send(bus, &Notification::test(language))
}
