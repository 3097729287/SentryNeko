//! Module registration. Tauri builder setup and command registration land in T02/T03.

pub mod commands;
pub mod config;
pub mod collectors;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

/// Starts the application. Replaced by the Tauri builder once the app configuration exists.
pub fn run() {}
