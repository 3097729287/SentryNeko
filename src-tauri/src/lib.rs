//! Module registration and Tauri application bootstrap.

pub mod collectors;
pub mod commands;
pub mod config;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

use tauri::Manager;

use crate::config::Config;
use crate::db::connection::Db;
use crate::db::migrations;

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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the SentryNeko application");
}
