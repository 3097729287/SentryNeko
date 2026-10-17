//! Module registration and Tauri application bootstrap.

pub mod collectors;
pub mod commands;
pub mod config;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

use tauri::Manager;

use crate::commands::{event_commands, settings_commands};
use crate::config::Config;
use crate::db::connection::Db;
use crate::db::migrations;
use crate::services::event_bus::EventBus;

/// Builds and runs the application.
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            let config = Config::open(&directory)?;
            let db = Db::open(config.database_path()?)?;
            migrations::migrate(&db)?;
            app.manage(config);
            app.manage(db);
            app.manage(EventBus::new(app.handle().clone()));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings_commands::get_language,
            settings_commands::set_language,
            event_commands::emit_test_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running the SentryNeko application");
}
