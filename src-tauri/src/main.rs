//! Application entry point.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sentry_neko_lib::run();
}
