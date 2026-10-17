//! Module registration and Tauri application bootstrap.

pub mod collectors;
pub mod commands;
pub mod config;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

use tauri::Manager;

use crate::db::connection::{Db, DATABASE_FILE_NAME};
use crate::db::migrations;

/// Builds and runs the application.
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            let db = Db::open(directory.join(DATABASE_FILE_NAME))?;
            migrations::migrate(&db)?;
            app.manage(db);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the SentryNeko application");
}
