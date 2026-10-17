//! System information collection: boot time, and CPU / memory / disk metrics.

use serde::Serialize;

use crate::utils::response::{ApiError, ApiResult};
use crate::utils::time;
use crate::utils::windows;

/// How long the machine has been up, and how much of that falls inside today.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Uptime {
    /// UTC epoch seconds of the boot the counter points at.
    pub boot_at: i64,
    /// Seconds the machine was up since local midnight, so never more than `total_seconds`.
    pub today_seconds: i64,
    /// Seconds since the boot, sleep and hibernation included.
    pub total_seconds: i64,
}

impl Uptime {
    /// Reads the boot counter and the local day boundary.
    ///
    /// The counter is read on every call rather than cached at startup: `GetTickCount64` keeps
    /// counting through sleep, so the boot instant derived from it does not move when the machine
    /// resumes, and a wall clock adjusted later cannot leave a stale answer behind.
    pub fn now() -> ApiResult<Self> {
        let now = time::now_seconds();
        let total_seconds = i64::try_from(windows::milliseconds_since_boot() / 1_000)
            .map_err(|_| ApiError::internal("the uptime counter is out of range"))?;
        let day_start = windows::local_midnight(now)
            .ok_or_else(|| ApiError::internal("the local midnight could not be resolved"))?;

        Ok(Self::assemble(now, total_seconds, day_start))
    }

    /// Builds the answer from the instants, so the day arithmetic can be tested without a clock.
    ///
    /// A machine booted before midnight only counts the part of its uptime that is after the
    /// boundary; one booted during the day counts all of it.
    #[must_use]
    pub fn assemble(now: i64, total_seconds: i64, day_start: i64) -> Self {
        let total_seconds = total_seconds.max(0);
        let boot_at = now.saturating_sub(total_seconds);
        let today_seconds = now
            .saturating_sub(boot_at.max(day_start))
            .clamp(0, total_seconds);

        Self {
            boot_at,
            today_seconds,
            total_seconds,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A machine booted yesterday at 22:00, asked at 09:00 today.
    #[test]
    fn a_boot_before_midnight_counts_only_the_part_after_it() {
        let now = 1_700_000_000;
        let day_start = now - 9 * 3_600;
        let total = 11 * 3_600;

        let uptime = Uptime::assemble(now, total, day_start);

        assert_eq!(uptime.boot_at, now - total);
        assert_eq!(uptime.total_seconds, total);
        assert_eq!(uptime.today_seconds, 9 * 3_600);
    }

    #[test]
    fn a_boot_during_the_day_counts_the_whole_uptime() {
        let now = 1_700_000_000;
        let total = 3_600;

        let uptime = Uptime::assemble(now, total, now - 8 * 3_600);

        assert_eq!(uptime.today_seconds, total);
        assert_eq!(uptime.boot_at, now - total);
    }

    #[test]
    fn a_machine_up_for_days_still_counts_today_only() {
        let now = 1_700_000_000;
        let day_start = now - 5 * 3_600;
        let total = 3 * 86_400 + 12 * 3_600;

        let uptime = Uptime::assemble(now, total, day_start);

        assert_eq!(uptime.total_seconds, total);
        assert_eq!(uptime.today_seconds, 5 * 3_600);
    }

    #[test]
    fn a_clock_that_disagrees_with_the_counter_stays_in_range() {
        let now = 1_000;

        let behind = Uptime::assemble(now, 50, now + 500);
        assert_eq!(behind.today_seconds, 0);

        let nonsense = Uptime::assemble(now, -600, now - 10);
        assert_eq!(nonsense.total_seconds, 0);
        assert_eq!(nonsense.today_seconds, 0);
    }

    #[test]
    fn the_live_answer_is_consistent_with_the_clock() {
        let uptime = Uptime::now().expect("the machine reports its uptime");
        let now = time::now_seconds();

        assert!(uptime.total_seconds > 0, "a running machine has uptime");
        assert!(uptime.today_seconds <= uptime.total_seconds);
        assert!(uptime.today_seconds <= 86_400);
        assert!(uptime.boot_at > 1_600_000_000, "booted after 2020");
        assert!(uptime.boot_at <= now);
    }
}
