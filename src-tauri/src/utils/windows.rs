//! Win32 FFI declarations and safe wrappers. All platform-specific code lives here.
//!
//! The calls are declared by hand instead of pulling in the `windows` crate: the collectors need
//! a handful of them, and a hand-written binding keeps the dependency list short.

use std::ffi::c_void;
use std::ptr;

/// Opaque handle type: `HWND` for windows, `HANDLE` for kernel objects.
type Handle = *mut c_void;

/// A window handle (`HWND`).
type WindowHandle = Handle;

/// Lets the caller read a process that runs at a higher integrity level.
const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

/// Longest image path `QueryFullProcessImageNameW` returns, in UTF-16 code units.
const MAX_IMAGE_PATH_UNITS: usize = 32_768;

/// 100-nanosecond intervals between 1601-01-01 (`FILETIME` origin) and 1970-01-01.
const UNIX_EPOCH_IN_FILETIME: u64 = 116_444_736_000_000_000;

/// 100-nanosecond intervals in one second.
const FILETIME_PER_SECOND: u64 = 10_000_000;

/// `SYSTEMTIME`: a broken-down local or universal time, as Windows reports it.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
struct SystemTime {
    year: u16,
    month: u16,
    day_of_week: u16,
    day: u16,
    hour: u16,
    minute: u16,
    second: u16,
    milliseconds: u16,
}

/// `FILETIME`: 100-nanosecond intervals since 1601-01-01, split into two words.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
struct FileTime {
    low: u32,
    high: u32,
}

/// `LASTINPUTINFO`: when the last keyboard or mouse input arrived, on the tick clock.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
struct LastInputInfo {
    size: u32,
    tick: u32,
}

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
    fn GetTickCount() -> u32;
    fn GetTickCount64() -> u64;
    fn GetLastInputInfo(last_input: *mut LastInputInfo) -> i32;
    fn OpenProcess(access: u32, inherit: i32, process_id: u32) -> Handle;
    fn CloseHandle(handle: Handle) -> i32;
    fn QueryFullProcessImageNameW(
        handle: Handle,
        flags: u32,
        buffer: *mut u16,
        size: *mut u32,
    ) -> i32;
    fn FileTimeToSystemTime(file_time: *const FileTime, system_time: *mut SystemTime) -> i32;
    fn SystemTimeToFileTime(system_time: *const SystemTime, file_time: *mut FileTime) -> i32;
    fn SystemTimeToTzSpecificLocalTime(
        zone: *const c_void,
        universal: *const SystemTime,
        local: *mut SystemTime,
    ) -> i32;
    fn TzSpecificLocalTimeToSystemTime(
        zone: *const c_void,
        local: *const SystemTime,
        universal: *mut SystemTime,
    ) -> i32;
}

/// A local calendar date, as Windows breaks it down.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LocalDate {
    pub year: u16,
    pub month: u16,
    pub day: u16,
    /// Day of the week, `0` being Sunday.
    pub weekday: u16,
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

/// Milliseconds the machine has been up.
///
/// `GetTickCount64` follows the interrupt time, which keeps running through sleep and
/// hibernation; a suspend therefore does not shift the boot instant derived from it.
#[must_use]
pub fn milliseconds_since_boot() -> u64 {
    unsafe { GetTickCount64() }
}

/// Milliseconds since the last keyboard or mouse input.
///
/// Answers `None` when Windows cannot report it, which only happens outside an interactive
/// session; the caller then has to decide whether to keep going.
#[must_use]
pub fn milliseconds_since_last_input() -> Option<u64> {
    let mut last = LastInputInfo {
        size: std::mem::size_of::<LastInputInfo>() as u32,
        tick: 0,
    };

    if unsafe { GetLastInputInfo(&mut last) } == 0 {
        return None;
    }

    // Both values ride the same 32-bit tick clock, so the wrapping subtraction survives its
    // 49-day rollover.
    let now = unsafe { GetTickCount() };

    Some(u64::from(now.wrapping_sub(last.tick)))
}

/// UTC epoch seconds of the local midnight that starts the day `utc_seconds` falls in.
///
/// The local time is resolved through the Windows time zone rules rather than a stored offset, so
/// the answer stays right on the two days a year the offset changes. `None` when Windows cannot
/// break the instant down.
#[must_use]
pub fn local_midnight(utc_seconds: i64) -> Option<i64> {
    let universal = system_time_of(utc_seconds)?;

    let mut local = SystemTime::default();
    if unsafe { SystemTimeToTzSpecificLocalTime(ptr::null(), &universal, &mut local) } == 0 {
        return None;
    }

    let midnight = SystemTime {
        hour: 0,
        minute: 0,
        second: 0,
        milliseconds: 0,
        ..local
    };

    let mut start = SystemTime::default();
    if unsafe { TzSpecificLocalTimeToSystemTime(ptr::null(), &midnight, &mut start) } != 0 {
        if let Some(file_time) = file_time_of(&start) {
            return seconds_since_epoch(file_time);
        }
    }

    // A zone can jump over the midnight hour when its clock moves; the wall clock still says how
    // much of the day has passed, which is close enough for a fallback.
    Some(utc_seconds - seconds_of_day(&local))
}

/// Local calendar date of `utc_seconds`; `None` when Windows cannot break the instant down.
#[must_use]
pub fn local_date(utc_seconds: i64) -> Option<LocalDate> {
    let universal = system_time_of(utc_seconds)?;
    let mut local = SystemTime::default();

    if unsafe { SystemTimeToTzSpecificLocalTime(ptr::null(), &universal, &mut local) } == 0 {
        return None;
    }

    Some(LocalDate {
        year: local.year,
        month: local.month,
        day: local.day,
        weekday: local.day_of_week,
    })
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

/// Broken-down universal time of an epoch instant.
fn system_time_of(utc_seconds: i64) -> Option<SystemTime> {
    let hundred_nanos = u64::try_from(utc_seconds)
        .ok()?
        .checked_mul(FILETIME_PER_SECOND)?
        .checked_add(UNIX_EPOCH_IN_FILETIME)?;
    let file_time = FileTime {
        low: hundred_nanos as u32,
        high: (hundred_nanos >> 32) as u32,
    };

    let mut system_time = SystemTime::default();
    (unsafe { FileTimeToSystemTime(&file_time, &mut system_time) } != 0).then_some(system_time)
}

/// `FILETIME` of a broken-down time.
fn file_time_of(system_time: &SystemTime) -> Option<FileTime> {
    let mut file_time = FileTime::default();
    (unsafe { SystemTimeToFileTime(system_time, &mut file_time) } != 0).then_some(file_time)
}

/// Epoch seconds of a `FILETIME`; `None` for an instant before 1970.
fn seconds_since_epoch(file_time: FileTime) -> Option<i64> {
    let hundred_nanos = (u64::from(file_time.high) << 32) | u64::from(file_time.low);
    let seconds = hundred_nanos.checked_sub(UNIX_EPOCH_IN_FILETIME)? / FILETIME_PER_SECOND;

    i64::try_from(seconds).ok()
}

/// Seconds since local midnight, ignoring an offset change earlier in the day.
fn seconds_of_day(local: &SystemTime) -> i64 {
    i64::from(local.hour) * 3_600 + i64::from(local.minute) * 60 + i64::from(local.second)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> i64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("the clock is after 1970")
            .as_secs() as i64
    }

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

    #[test]
    fn the_boot_counter_has_started() {
        assert!(milliseconds_since_boot() > 0);
    }

    #[test]
    fn the_last_input_is_reported_in_a_desktop_session() {
        // Only a session without an input desktop cannot answer; the collector then keeps
        // recording instead of guessing that the user is away.
        if let Some(idle) = milliseconds_since_last_input() {
            assert!(
                idle < 7 * 24 * 3_600_000,
                "the tick clock restarted instead of rolling over: {idle}"
            );
        }
    }

    #[test]
    fn the_local_midnight_belongs_to_the_current_day() {
        let now = now();
        let midnight = local_midnight(now).expect("the day has a start");

        assert!(
            midnight <= now,
            "midnight {midnight} is not after now {now}"
        );
        assert!(
            now - midnight < 86_400,
            "midnight {midnight} is more than a day before {now}"
        );
    }

    #[test]
    fn the_local_midnight_of_a_midnight_is_itself() {
        let midnight = local_midnight(now()).expect("the day has a start");

        assert_eq!(local_midnight(midnight), Some(midnight));
    }

    #[test]
    fn the_local_date_agrees_with_the_midnight_it_belongs_to() {
        let now = now();
        let date = local_date(now).expect("the day has a date");
        let midnight = local_midnight(now).expect("the day has a start");

        assert!((1..=12).contains(&date.month), "{date:?}");
        assert!((1..=31).contains(&date.day), "{date:?}");
        assert!(date.weekday < 7, "{date:?}");
        assert_eq!(local_midnight(midnight), Some(midnight));
        assert_eq!(
            local_date(midnight).map(|start| (start.year, start.month, start.day)),
            Some((date.year, date.month, date.day))
        );
    }

    #[test]
    fn an_instant_before_1970_has_no_epoch_form() {
        assert!(system_time_of(-1).is_none());
    }
}
