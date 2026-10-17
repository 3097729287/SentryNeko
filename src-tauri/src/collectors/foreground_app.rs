//! Foreground application collector built on GetForegroundWindow and GetWindowText.
//!
//! The loop runs on its own thread, one sample per second, and writes through
//! [`crate::models::app_event::AppEvent`]; it never touches the UI. A sample that matches the
//! row already open writes nothing, so an unchanged window is not recorded twice.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::db::connection::Db;
use crate::models::app_event::AppEvent;
use crate::utils::response::{ApiError, ApiResult};
use crate::utils::time;
use crate::utils::windows;

/// How often the foreground window is sampled.
///
/// Rows are stored with second resolution, so sampling faster would not add detail; a slower
/// loop would blur short switches.
pub const POLL_INTERVAL: Duration = Duration::from_secs(1);

/// What the collector saw, already stripped of the windows it ignores.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sample {
    /// Executable file name without its extension, e.g. `chrome`.
    pub app_name: String,
    /// Caption of the foreground window, trimmed; `None` when it has none.
    pub window_title: Option<String>,
}

/// How a sample relates to the row that is still open.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Change {
    /// Same app, same window: nothing to write.
    Nothing,
    /// Same app, new window title: the open row is renamed.
    Retitle { id: i64 },
    /// Another app took over: the open row closes and a new one opens.
    Switch,
}

/// Keeps exactly one `app_events` row open for the app in front of the user.
pub struct ForegroundCollector {
    db: Db,
    open: Option<AppEvent>,
}

impl ForegroundCollector {
    /// Builds a collector that owns no row yet.
    #[must_use]
    pub fn new(db: Db) -> Self {
        Self { db, open: None }
    }

    /// Applies one observation taken at `now`.
    ///
    /// An unchanged window writes nothing, so polling the same switch every second cannot
    /// duplicate rows; a new app closes the open row exactly on the switch.
    pub fn observe(&mut self, sample: Option<Sample>, now: i64) -> ApiResult<()> {
        let Some(sample) = sample else {
            return self.close(now);
        };

        match self.change_for(&sample) {
            Change::Nothing => Ok(()),
            Change::Retitle { id } => {
                let renamed = AppEvent::retitle(&self.db, id, sample.window_title.as_deref())?;
                self.open = Some(renamed);

                Ok(())
            }
            Change::Switch => {
                self.close(now)?;
                self.open = Some(AppEvent::open(
                    &self.db,
                    &sample.app_name,
                    sample.window_title.as_deref(),
                    now,
                )?);

                Ok(())
            }
        }
    }

    /// Ends the open row; nothing is written when no row is open.
    pub fn close(&mut self, now: i64) -> ApiResult<()> {
        let Some(open) = self.open.take() else {
            return Ok(());
        };

        // A clock that steps backwards must not produce an end before the start.
        AppEvent::close(&self.db, open.id, now.max(open.started_at))?;

        Ok(())
    }

    fn change_for(&self, sample: &Sample) -> Change {
        match &self.open {
            Some(open) if open.app_name == sample.app_name => {
                if open.window_title == sample.window_title {
                    Change::Nothing
                } else {
                    Change::Retitle { id: open.id }
                }
            }
            _ => Change::Switch,
        }
    }
}

/// Handle to the running collector.
///
/// Keep it in Tauri managed state: [`Self::stop`] closes the last row and joins the thread, so
/// quitting the app does not leave a row open forever.
pub struct RunningCollector {
    stopped: Arc<AtomicBool>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl RunningCollector {
    /// Starts the sampling loop on a background thread.
    pub fn spawn(db: Db) -> ApiResult<Self> {
        let stopped = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&stopped);
        let mut collector = ForegroundCollector::new(db);

        let thread = thread::Builder::new()
            .name("foreground-collector".to_owned())
            .spawn(move || {
                while !flag.load(Ordering::Relaxed) {
                    // A failed write must not kill the loop: the next sample retries, otherwise
                    // one lock timeout would cost the rest of the day.
                    let _ = collector.observe(sample(), time::now_seconds());
                    thread::park_timeout(POLL_INTERVAL);
                }

                let _ = collector.close(time::now_seconds());
            })
            .map_err(|error| {
                ApiError::internal("the foreground collector could not start")
                    .with_details(error.to_string())
            })?;

        Ok(Self {
            stopped,
            thread: Mutex::new(Some(thread)),
        })
    }

    /// Asks the loop to finish and waits for the last row to be closed.
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::Relaxed);

        let Ok(mut thread) = self.thread.lock() else {
            return;
        };
        let Some(handle) = thread.take() else {
            return;
        };

        handle.thread().unpark();
        let _ = handle.join();
    }
}

/// Reads the foreground window, dropping our own: time spent in SentryNeko is not activity.
fn sample() -> Option<Sample> {
    keep(windows::foreground_app()?, windows::current_process_id())
}

/// Drops the window when it belongs to `own_process_id`.
fn keep(foreground: windows::ForegroundApp, own_process_id: u32) -> Option<Sample> {
    if foreground.process_id == own_process_id {
        return None;
    }

    Some(Sample {
        app_name: foreground.app_name,
        window_title: foreground.window_title,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repository;
    use crate::db::schema;

    fn created() -> Db {
        let db = Db::open_in_memory().expect("in-memory database opens");
        schema::ensure(&db).expect("schema is created");
        db
    }

    fn rows(db: &Db) -> Vec<AppEvent> {
        repository::query_all(
            db,
            "SELECT id, app_name, window_title, started_at, ended_at FROM app_events ORDER BY id",
            [],
            AppEvent::from_row,
        )
        .expect("the rows are readable")
    }

    fn seen(app_name: &str, window_title: Option<&str>) -> Option<Sample> {
        Some(Sample {
            app_name: app_name.to_owned(),
            window_title: window_title.map(str::to_owned),
        })
    }

    #[test]
    fn polling_the_same_window_twice_writes_one_row() {
        let db = created();
        let mut collector = ForegroundCollector::new(db.clone());

        for now in [100, 101, 102] {
            collector
                .observe(seen("code", Some("main.rs")), now)
                .expect("observed");
        }

        let stored = rows(&db);
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].app_name, "code");
        assert_eq!(stored[0].started_at, 100);
        assert_eq!(stored[0].ended_at, None);
    }

    #[test]
    fn a_switch_closes_the_previous_row_at_the_same_instant() {
        let db = created();
        let mut collector = ForegroundCollector::new(db.clone());

        collector
            .observe(seen("code", Some("main.rs")), 100)
            .expect("first app");
        collector
            .observe(seen("chrome", Some("docs")), 160)
            .expect("second app");

        let stored = rows(&db);
        assert_eq!(stored.len(), 2);
        assert_eq!(stored[0].app_name, "code");
        assert_eq!(stored[0].ended_at, Some(160));
        assert_eq!(stored[1].app_name, "chrome");
        assert_eq!(stored[1].started_at, 160);
        assert_eq!(stored[1].ended_at, None);
    }

    #[test]
    fn a_title_change_updates_the_open_row_instead_of_splitting_it() {
        let db = created();
        let mut collector = ForegroundCollector::new(db.clone());

        collector
            .observe(seen("chrome", Some("tab one")), 100)
            .expect("first tab");
        collector
            .observe(seen("chrome", Some("tab two")), 140)
            .expect("second tab");

        let stored = rows(&db);
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].window_title.as_deref(), Some("tab two"));
        assert_eq!(stored[0].started_at, 100);
        assert_eq!(stored[0].ended_at, None);
    }

    #[test]
    fn nothing_in_front_closes_the_open_row() {
        let db = created();
        let mut collector = ForegroundCollector::new(db.clone());

        collector
            .observe(seen("code", Some("main.rs")), 100)
            .expect("observed");
        collector.observe(None, 150).expect("locked or unknown");
        collector.observe(None, 160).expect("still nothing");

        let stored = rows(&db);
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].ended_at, Some(150));
    }

    #[test]
    fn our_own_window_never_becomes_a_sample() {
        let own = windows::ForegroundApp {
            app_name: "SentryNeko".to_owned(),
            window_title: Some("SentryNeko".to_owned()),
            process_id: 4_242,
        };

        assert_eq!(keep(own.clone(), 4_242), None);
        assert_eq!(
            keep(own, 4_243),
            seen("SentryNeko", Some("SentryNeko")),
            "another process is kept"
        );
    }

    #[test]
    fn a_clock_that_steps_back_does_not_end_a_row_before_it_starts() {
        let db = created();
        let mut collector = ForegroundCollector::new(db.clone());

        collector
            .observe(seen("code", Some("main.rs")), 500)
            .expect("observed");
        collector.observe(None, 400).expect("clock stepped back");

        assert_eq!(rows(&db)[0].ended_at, Some(500));
    }
}
