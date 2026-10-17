//! Event bus forwarding collector and timer events to the frontend.

use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::utils::response::{ApiError, ApiResult};

/// Event names the backend pushes to the frontend; each one is documented in `docs/events.md`.
pub mod names {
    /// Pushed by `emit_test_event` so the wiring can be verified end to end.
    pub const TEST_EVENT: &str = "test-event";
}

/// Payload of [`names::TEST_EVENT`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestEvent {
    /// Rises with every push, so the UI can tell two of them apart.
    pub sequence: u64,
}

/// What the bus pushes to: the Tauri handle in the application, a recorder in tests.
pub trait EventSink: Send + Sync + 'static {
    /// Hands one payload to the frontend; fails when it cannot be handed over.
    fn emit(&self, event: &str, payload: serde_json::Value) -> ApiResult<()>;
}

impl EventSink for AppHandle {
    fn emit(&self, event: &str, payload: serde_json::Value) -> ApiResult<()> {
        Emitter::emit(self, event, payload).map_err(|error| {
            ApiError::internal(format!(
                "event `{event}` could not be pushed to the frontend"
            ))
            .with_details(error.to_string())
        })
    }
}

/// Pushes typed events to the frontend; share it through Tauri managed state.
pub struct EventBus {
    sink: Box<dyn EventSink>,
    sequence: AtomicU64,
}

impl EventBus {
    /// Builds a bus that pushes through `sink`.
    #[must_use]
    pub fn new(sink: impl EventSink) -> Self {
        Self {
            sink: Box::new(sink),
            sequence: AtomicU64::new(0),
        }
    }

    /// Pushes [`names::TEST_EVENT`] and answers with what was sent; fails when it cannot be sent.
    pub fn emit_test_event(&self) -> ApiResult<TestEvent> {
        let payload = TestEvent {
            sequence: self.sequence.fetch_add(1, Ordering::Relaxed) + 1,
        };

        self.sink
            .emit(names::TEST_EVENT, serde_json::to_value(payload)?)?;

        Ok(payload)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::response::ApiCode;
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Default)]
    struct Recorder {
        pushed: Arc<Mutex<Vec<(String, serde_json::Value)>>>,
    }

    impl Recorder {
        fn pushed(&self) -> Vec<(String, serde_json::Value)> {
            self.pushed
                .lock()
                .expect("the recorder lock is not poisoned")
                .clone()
        }
    }

    impl EventSink for Recorder {
        fn emit(&self, event: &str, payload: serde_json::Value) -> ApiResult<()> {
            self.pushed
                .lock()
                .expect("the recorder lock is not poisoned")
                .push((event.to_owned(), payload));

            Ok(())
        }
    }

    struct RefusingSink;

    impl EventSink for RefusingSink {
        fn emit(&self, event: &str, _payload: serde_json::Value) -> ApiResult<()> {
            Err(ApiError::internal(format!("`{event}` was refused")))
        }
    }

    #[test]
    fn a_test_event_reaches_the_sink_with_a_rising_sequence() {
        let recorder = Recorder::default();
        let bus = EventBus::new(recorder.clone());

        let first = bus.emit_test_event().expect("the first event is pushed");
        let second = bus.emit_test_event().expect("the second event is pushed");

        assert_eq!(first.sequence, 1);
        assert_eq!(second.sequence, 2);

        let pushed = recorder.pushed();
        assert_eq!(pushed.len(), 2);
        assert_eq!(pushed[0].0, names::TEST_EVENT);
        assert_eq!(pushed[0].1["sequence"], serde_json::json!(1));
        assert_eq!(pushed[1].1["sequence"], serde_json::json!(2));
    }

    #[test]
    fn a_refusing_sink_surfaces_as_an_error() {
        let bus = EventBus::new(RefusingSink);

        let error = bus.emit_test_event().expect_err("the push fails");

        assert_eq!(error.code(), ApiCode::Internal);
        assert!(
            error.message().contains(names::TEST_EVENT),
            "the message names the event: {error:?}"
        );
    }
}
