//! Time helpers: UTC epoch handling and local day/week boundaries.

use std::time::{SystemTime, UNIX_EPOCH};

/// Current UTC time in epoch seconds, the unit every timestamp column stores.
pub fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn now_seconds_is_a_plausible_epoch_timestamp() {
        let now = now_seconds();

        assert!(now > 1_600_000_000, "after September 2020: {now}");
        assert!(now < 4_000_000_000, "before the year 2096: {now}");
    }
}
