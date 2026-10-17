//! Auto-start with Windows, kept in the per-user run key.
//!
//! There is no separate collector process to install: the application is the resident process, so
//! "start with Windows" is one value under `HKCU\...\Run` pointing at this executable with a flag.
//! The flag is what lets a login start stay in the tray instead of throwing a window at the user.
//!
//! The registry sits behind [`RunKey`] so the decision logic can be tested without writing to the
//! machine's real key.

use std::path::Path;

use crate::utils::response::{ApiCode, ApiError, ApiResult};
use crate::utils::windows;

/// Value name under the run key; one per user is enough.
pub const VALUE_NAME: &str = "SentryNeko";

/// Argument the login entry starts the application with, so it can stay in the tray.
pub const FLAG: &str = "--autostart";

/// The run key: the machine's own in the application, a fake in tests.
pub trait RunKey: Send + Sync + 'static {
    /// The command stored under `name`; the message is the platform's reason on failure.
    fn read(&self, name: &str) -> Result<Option<String>, String>;
    /// Stores `command` under `name`, replacing what was there.
    fn write(&self, name: &str, command: &str) -> Result<(), String>;
    /// Removes the entry under `name`; removing what is not there is not a failure.
    fn clear(&self, name: &str) -> Result<(), String>;
}

/// The per-user run key of this machine.
pub struct WindowsRunKey;

impl RunKey for WindowsRunKey {
    fn read(&self, name: &str) -> Result<Option<String>, String> {
        windows::run_at_login(name)
    }

    fn write(&self, name: &str, command: &str) -> Result<(), String> {
        windows::set_run_at_login(name, command)
    }

    fn clear(&self, name: &str) -> Result<(), String> {
        windows::clear_run_at_login(name)
    }
}

/// Registers the application for a login start, and reads back what is registered.
pub struct Autostart<K: RunKey> {
    key: K,
}

impl<K: RunKey> Autostart<K> {
    #[must_use]
    pub fn new(key: K) -> Self {
        Self { key }
    }

    /// Whether Windows would start `program` the way this build expects to be started.
    ///
    /// An entry pointing somewhere else — an older install, or a path that no longer exists —
    /// counts as off, so switching it on repairs it instead of silently keeping the stale command.
    pub fn enabled(&self, program: &Path) -> ApiResult<bool> {
        let stored = self
            .key
            .read(VALUE_NAME)
            .map_err(|error| denied("the login entry could not be read", error))?;

        Ok(stored
            .is_some_and(|command| command.trim().eq_ignore_ascii_case(&command_line(program))))
    }

    /// Registers `program` to start at login, or removes the entry; answers what is in force.
    ///
    /// Both directions are idempotent: writing the same command twice leaves one entry, and
    /// clearing an entry that is already gone succeeds.
    pub fn set(&self, program: &Path, enabled: bool) -> ApiResult<bool> {
        if enabled {
            self.key
                .write(VALUE_NAME, &command_line(program))
                .map_err(|error| denied("the login entry could not be written", error))?;
        } else {
            self.key
                .clear(VALUE_NAME)
                .map_err(|error| denied("the login entry could not be removed", error))?;
        }

        Ok(enabled)
    }
}

/// The command line the run key stores for `program`.
///
/// The path is quoted because an install under `Program Files` contains a space; Windows splits a
/// run value on whitespace otherwise.
#[must_use]
pub fn command_line(program: &Path) -> String {
    format!("\"{}\" {FLAG}", program.display())
}

/// Whether Windows started this process, rather than the user.
#[must_use]
pub fn launched_at_login() -> bool {
    launched_with(std::env::args())
}

/// Whether any argument is [`FLAG`]; separated so tests do not depend on the real command line.
#[must_use]
pub fn launched_with(args: impl IntoIterator<Item = String>) -> bool {
    args.into_iter().any(|arg| arg == FLAG)
}

fn denied(context: &str, error: String) -> ApiError {
    ApiError::new(ApiCode::PermissionDenied)
        .with_message(context)
        .with_details(error)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};

    /// A run key that keeps its entries in memory; `refuse` makes every write and clear fail.
    #[derive(Clone, Default)]
    struct FakeRunKey {
        entries: Arc<Mutex<BTreeMap<String, String>>>,
        refuse: bool,
    }

    impl FakeRunKey {
        fn refusing() -> Self {
            Self {
                refuse: true,
                ..Self::default()
            }
        }

        fn entries(&self) -> BTreeMap<String, String> {
            self.entries
                .lock()
                .expect("the map lock is not poisoned")
                .clone()
        }

        fn seed(&self, name: &str, command: &str) {
            self.entries
                .lock()
                .expect("the map lock is not poisoned")
                .insert(name.to_owned(), command.to_owned());
        }
    }

    impl RunKey for FakeRunKey {
        fn read(&self, name: &str) -> Result<Option<String>, String> {
            Ok(self.entries().get(name).cloned())
        }

        fn write(&self, name: &str, command: &str) -> Result<(), String> {
            if self.refuse {
                return Err("access denied".to_owned());
            }

            self.seed(name, command);

            Ok(())
        }

        fn clear(&self, name: &str) -> Result<(), String> {
            if self.refuse {
                return Err("access denied".to_owned());
            }

            self.entries
                .lock()
                .expect("the map lock is not poisoned")
                .remove(name);

            Ok(())
        }
    }

    fn program() -> PathBuf {
        PathBuf::from(r"C:\Program Files\SentryNeko\sentry-neko.exe")
    }

    #[test]
    fn the_command_line_quotes_the_path_and_asks_for_a_quiet_start() {
        assert_eq!(
            command_line(&program()),
            r#""C:\Program Files\SentryNeko\sentry-neko.exe" --autostart"#
        );
        assert_eq!(
            command_line(Path::new(r"C:\Apps\SentryNeko.exe")),
            r#""C:\Apps\SentryNeko.exe" --autostart"#,
            "every path is quoted, not only the ones with spaces"
        );
    }

    #[test]
    fn a_fresh_profile_reports_the_application_as_not_starting() {
        let autostart = Autostart::new(FakeRunKey::default());

        assert!(!autostart.enabled(&program()).expect("read"));
    }

    #[test]
    fn switching_on_writes_the_entry_and_switching_off_removes_it() {
        let key = FakeRunKey::default();
        let autostart = Autostart::new(key.clone());

        assert!(autostart.set(&program(), true).expect("enabled"));
        assert_eq!(
            key.entries().get(VALUE_NAME).map(String::as_str),
            Some(command_line(&program()).as_str())
        );
        assert!(autostart.enabled(&program()).expect("read"));

        assert!(!autostart.set(&program(), false).expect("disabled"));
        assert!(key.entries().is_empty());
        assert!(!autostart.enabled(&program()).expect("read"));
    }

    #[test]
    fn both_directions_can_be_repeated() {
        let key = FakeRunKey::default();
        let autostart = Autostart::new(key.clone());

        autostart.set(&program(), true).expect("enabled");
        autostart.set(&program(), true).expect("enabled again");
        assert_eq!(key.entries().len(), 1, "one entry, not two");

        autostart.set(&program(), false).expect("disabled");
        autostart.set(&program(), false).expect("disabled again");
        assert!(key.entries().is_empty());
    }

    #[test]
    fn an_entry_for_another_install_reads_as_off_and_is_repaired() {
        let key = FakeRunKey::default();
        key.seed(VALUE_NAME, r#""D:\Old\sentry-neko.exe" --autostart"#);
        let autostart = Autostart::new(key.clone());

        assert!(!autostart.enabled(&program()).expect("read"));

        autostart.set(&program(), true).expect("enabled");

        assert_eq!(
            key.entries().get(VALUE_NAME).map(String::as_str),
            Some(command_line(&program()).as_str())
        );
    }

    #[test]
    fn an_entry_without_the_quiet_flag_reads_as_off() {
        let key = FakeRunKey::default();
        key.seed(
            VALUE_NAME,
            r#""C:\Program Files\SentryNeko\sentry-neko.exe""#,
        );

        assert!(!Autostart::new(key).enabled(&program()).expect("read"));
    }

    #[test]
    fn a_key_that_refuses_reports_permission_denied() {
        let autostart = Autostart::new(FakeRunKey::refusing());

        let error = autostart.set(&program(), true).expect_err("refused");

        assert_eq!(error.code(), ApiCode::PermissionDenied);
        assert!(error.details().expect("details").contains("access denied"));
    }

    #[test]
    fn the_quiet_flag_is_read_from_the_arguments() {
        let arguments = |items: &[&str]| {
            items
                .iter()
                .map(|item| (*item).to_owned())
                .collect::<Vec<_>>()
        };

        assert!(launched_with(arguments(&[
            r"C:\Program Files\SentryNeko\sentry-neko.exe",
            FLAG,
        ])));
        assert!(!launched_with(arguments(&[
            r"C:\Program Files\SentryNeko\sentry-neko.exe",
        ])));
        assert!(
            !launched_with(arguments(&["--autostart=yes"])),
            "only the exact flag counts"
        );
    }
}
