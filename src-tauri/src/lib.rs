//! Module registration and Tauri application bootstrap.

pub mod collectors;
pub mod commands;
pub mod config;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

use tauri::Manager;

use crate::commands::{
    event_commands, pomodoro_commands, settings_commands, tag_commands, todo_commands,
};
use crate::config::Config;
use crate::db::connection::Db;
use crate::db::schema;
use crate::services::event_bus::EventBus;

/// Builds and runs the application.
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            let config = Config::open(&directory)?;
            let db = Db::open(config.database_path()?)?;
            schema::ensure(&db)?;
            app.manage(config);
            app.manage(db);
            app.manage(EventBus::new(app.handle().clone()));

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
            pomodoro_commands::start_pomodoro_session,
            pomodoro_commands::finish_pomodoro_session,
            pomodoro_commands::list_pomodoro_sessions
        ])
        .run(tauri::generate_context!())
        .expect("error while running the SentryNeko application");
}
