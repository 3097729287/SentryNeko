//! System information commands: how long the machine has been up.

use crate::collectors::system_info::Uptime;
use crate::utils::response::ApiResponse;

/// Answers the boot instant, the seconds since boot and the part of them that is today.
#[tauri::command]
pub fn get_uptime() -> ApiResponse<Uptime> {
    Uptime::now().into()
}
