//! Module registration and Tauri application bootstrap.

pub mod collectors;
pub mod commands;
pub mod config;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

use tauri::{Manager, RunEvent};

use crate::collectors::foreground_app::RunningCollector;
use crate::commands::{
    app_event_commands, event_commands, heatmap_commands, notification_commands, pomodoro_commands,
    settings_commands, system_commands, tag_commands, todo_commands,
};
use crate::config::Config;
use crate::db::connection::Db;
use crate::db::schema;
use crate::services::event_bus::EventBus;

/// Builds and runs the application.
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            let config = Config::open(&directory)?;
            let db = Db::open(config.database_path()?)?;
            schema::ensure(&db)?;
            app.manage(config);
            app.manage(db.clone());
            let bus = EventBus::new(app.handle().clone());
            app.manage(bus.clone());
            app.manage(RunningCollector::spawn(db, bus)?);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings_commands::get_language,
            settings_commands::set_language,
            event_commands::emit_test_event,
            todo_commands::list_todos,
            todo_commands::add_todo,
            todo_commands::rename_todo,
            todo_commands::set_todo_completed,
            todo_commands::delete_todo,
            todo_commands::todo_counts,
            tag_commands::list_tags,
            tag_commands::add_tag,
            tag_commands::rename_tag,
            tag_commands::delete_tag,
            tag_commands::set_todo_tags,
            tag_commands::todo_tags,
            tag_commands::todos_with_tag,
            settings_commands::get_pomodoro_durations,
            settings_commands::set_pomodoro_durations,
            notification_commands::send_test_notification,
            notification_commands::notify_pomodoro_phase,
            pomodoro_commands::start_pomodoro_session,
            pomodoro_commands::finish_pomodoro_session,
            pomodoro_commands::list_pomodoro_sessions,
            system_commands::get_uptime,
            app_event_commands::app_usage,
            heatmap_commands::heatmap
        ])
        .build(tauri::generate_context!())
        .expect("error while building the SentryNeko application");

    app.run(|handle, event| {
        // Closing the app ends the collector's open row instead of leaving it open forever.
        if matches!(event, RunEvent::Exit) {
            if let Some(collector) = handle.try_state::<RunningCollector>() {
                collector.stop();
            }
        }
    });
}
