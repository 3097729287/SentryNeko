//! Notification commands: the toast channel the pomodoro timer and the settings probe use.

use tauri::{AppHandle, State};

use crate::config::Config;
use crate::models::pomodoro::Phase;
use crate::services::event_bus::EventBus;
use crate::services::i18n::Language;
use crate::services::notification::{Notification, Notifier, Outcome};
use crate::utils::response::{ApiResponse, ApiResult};

/// Shows a test toast; when the system refuses it, the fallback event reaches the frontend.
#[tauri::command]
pub fn send_test_notification(
    app: AppHandle,
    config: State<'_, Config>,
    bus: State<'_, EventBus>,
) -> ApiResponse<Outcome> {
    notify(&app, &config, &bus, Notification::test).into()
}

/// Tells the user a pomodoro phase ran out; the timer moves on whether or not this succeeds.
#[tauri::command]
pub fn notify_pomodoro_phase(
    app: AppHandle,
    config: State<'_, Config>,
    bus: State<'_, EventBus>,
    phase: Phase,
) -> ApiResponse<Outcome> {
    notify(&app, &config, &bus, |language| {
        Notification::pomodoro(language, phase)
    })
    .into()
}

/// Builds the copy for the interface language, then hands the toast to the system.
fn notify(
    app: &AppHandle,
    config: &Config,
    bus: &EventBus,
    build: impl FnOnce(Language) -> Notification,
) -> ApiResult<Outcome> {
    let language = config.language()?;

    Notifier::new(app.clone()).send(bus, &build(language))
}
