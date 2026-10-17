//! Win32 FFI declarations and safe wrappers. All platform-specific code lives here.
//!
//! The calls are declared by hand instead of pulling in the `windows` crate: the collector needs
//! six of them, and a hand-written binding keeps the dependency list short.

use std::ffi::c_void;

/// Opaque handle type: `HWND` for windows, `HANDLE` for kernel objects.
type Handle = *mut c_void;

/// A window handle (`HWND`).
type WindowHandle = Handle;

/// Lets the caller read a process that runs at a higher integrity level.
const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

/// Longest image path `QueryFullProcessImageNameW` returns, in UTF-16 code units.
const MAX_IMAGE_PATH_UNITS: usize = 32_768;

#[link(name = "user32")]
extern "system" {
    fn GetForegroundWindow() -> WindowHandle;
    fn IsWindowVisible(window: WindowHandle) -> i32;
    fn GetWindowTextLengthW(window: WindowHandle) -> i32;
    fn GetWindowTextW(window: WindowHandle, buffer: *mut u16, capacity: i32) -> i32;
    fn GetWindowThreadProcessId(window: WindowHandle, process_id: *mut u32) -> u32;
}

#[link(name = "kernel32")]
extern "system" {
    fn GetCurrentProcessId() -> u32;
    fn OpenProcess(access: u32, inherit: i32, process_id: u32) -> Handle;
    fn CloseHandle(handle: Handle) -> i32;
    fn QueryFullProcessImageNameW(
        handle: Handle,
        flags: u32,
        buffer: *mut u16,
        size: *mut u32,
    ) -> i32;
}

/// The window the user is looking at, as far as the collector cares.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ForegroundApp {
    /// Executable file name without its extension, e.g. `chrome`.
    pub app_name: String,
    /// Caption of the window, trimmed; `None` when it is empty.
    pub window_title: Option<String>,
    /// Process that owns the window, so the caller can drop its own windows.
    pub process_id: u32,
}

/// Reads the foreground window.
///
/// Answers `None` when nothing is in front, when the window is hidden, or when Windows refuses to
/// name the process behind it — an elevated window cannot be opened by an ordinary process.
#[must_use]
pub fn foreground_app() -> Option<ForegroundApp> {
    let window = unsafe { GetForegroundWindow() };

    if window.is_null() || unsafe { IsWindowVisible(window) } == 0 {
        return None;
    }

    let process_id = process_id_of(window)?;
    let image = process_image_name(process_id)?;

    Some(ForegroundApp {
        app_name: executable_name(&image)?,
        window_title: window_title(window),
        process_id,
    })
}

/// Process id of the running application, so its own windows can be told apart.
#[must_use]
pub fn current_process_id() -> u32 {
    unsafe { GetCurrentProcessId() }
}

/// Executable file name without its extension: `C:\Apps\Code.exe` becomes `Code`.
#[must_use]
pub fn executable_name(image_path: &str) -> Option<String> {
    // A trailing separator marks a directory, whose last component `file_stem` would return.
    if image_path.ends_with(['\\', '/']) {
        return None;
    }

    let name = std::path::Path::new(image_path)
        .file_stem()?
        .to_string_lossy()
        .into_owned();

    (!name.is_empty()).then_some(name)
}

/// Process id that owns `window`; `None` when Windows reports none.
fn process_id_of(window: WindowHandle) -> Option<u32> {
    let mut process_id = 0u32;
    unsafe { GetWindowThreadProcessId(window, &mut process_id) };

    (process_id != 0).then_some(process_id)
}

/// Full path of the executable behind `process_id`.
fn process_image_name(process_id: u32) -> Option<String> {
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };

    if handle.is_null() {
        return None;
    }

    let mut buffer = vec![0u16; MAX_IMAGE_PATH_UNITS];
    let mut written = MAX_IMAGE_PATH_UNITS as u32;
    let read = unsafe { QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut written) };

    unsafe { CloseHandle(handle) };

    if read == 0 {
        return None;
    }

    Some(String::from_utf16_lossy(&buffer[..written as usize]))
}

/// Caption of `window`, trimmed; `None` when the window has none.
fn window_title(window: WindowHandle) -> Option<String> {
    let length = unsafe { GetWindowTextLengthW(window) };

    if length <= 0 {
        return None;
    }

    // The length does not count the terminating NUL, so one more unit is reserved for it.
    let mut buffer = vec![0u16; length as usize + 1];
    let written = unsafe { GetWindowTextW(window, buffer.as_mut_ptr(), buffer.len() as i32) };

    if written <= 0 {
        return None;
    }

    let title = String::from_utf16_lossy(&buffer[..written as usize]);
    let title = title.trim();

    (!title.is_empty()).then(|| title.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_executable_name_drops_the_directory_and_the_extension() {
        assert_eq!(
            executable_name(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
            Some("chrome".to_owned())
        );
        assert_eq!(
            executable_name(r"D:\Tools\SentryNeko.exe"),
            Some("SentryNeko".to_owned())
        );
        assert_eq!(executable_name("notepad"), Some("notepad".to_owned()));
    }

    #[test]
    fn an_empty_image_path_has_no_name() {
        assert_eq!(executable_name(""), None);
        assert_eq!(executable_name(r"C:\Program Files\"), None);
    }

    #[test]
    fn the_current_process_has_an_id() {
        assert_ne!(current_process_id(), 0);
    }
}
