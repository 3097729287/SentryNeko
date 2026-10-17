//! Windows Toast delivery with an in-app fallback.
//!
//! The frontend paints the fallback itself: the event carries the kind and the platform error,
//! never copy, so both sides keep their own translations.

use serde::Serialize;
use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

use crate::models::pomodoro::Phase;
use crate::services::event_bus::{EventBus, NotificationFallback};
use crate::services::i18n::Language;
use crate::utils::response::ApiResult;

/// What a notification is about; the in-app toast picks its copy from this.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationKind {
    Test,
    Pomodoro,
    Alarm,
}

/// One notification, with the copy already resolved for the interface language.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Notification {
    pub kind: NotificationKind,
    pub title: String,
    pub body: String,
}

impl Notification {
    /// The diagnostic behind `send_test_notification`.
    #[must_use]
    pub fn test(language: Language) -> Self {
        let body = match language {
            Language::ZhCn => "通知工作正常。",
            Language::EnUs => "Notifications are working.",
        };

        Self {
            body: body.to_owned(),
            kind: NotificationKind::Test,
            title: "SentryNeko".to_owned(),
        }
    }

    /// The copy shown when a pomodoro phase runs out and the next one starts on its own.
    #[must_use]
    pub fn pomodoro(language: Language, finished: Phase) -> Self {
        let (title, body) = match (language, finished) {
            (Language::ZhCn, Phase::Focus) => ("专注结束", "休息一下，下一阶段会自动开始。"),
            (Language::ZhCn, Phase::ShortBreak) => ("短休息结束", "已回到专注。"),
            (Language::ZhCn, Phase::LongBreak) => ("长休息结束", "已回到专注。"),
            (Language::EnUs, Phase::Focus) => (
                "Focus finished",
                "Take a break; the next phase starts on its own.",
            ),
            (Language::EnUs, Phase::ShortBreak) => ("Short break finished", "Back to focus."),
            (Language::EnUs, Phase::LongBreak) => ("Long break finished", "Back to focus."),
        };

        Self {
            body: body.to_owned(),
            kind: NotificationKind::Pomodoro,
            title: title.to_owned(),
        }
    }
}

/// Which path a delivery took.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Outcome {
    /// The system showed it.
    Toast,
    /// The system refused it; the frontend shows an in-app toast instead.
    Fallback,
}

/// Hands a toast to the system; [`AppHandle`] in the application, a fake in tests.
pub trait ToastSink: Send + Sync + 'static {
    /// Shows one toast; the error message is the platform's reason when it cannot.
    fn show(&self, title: &str, body: &str) -> Result<(), String>;
}

impl<R: Runtime> ToastSink for AppHandle<R> {
    fn show(&self, title: &str, body: &str) -> Result<(), String> {
        self.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|error| error.to_string())
    }
}

/// Delivers notifications through a [`ToastSink`], falling back to the event bus.
pub struct Notifier<T: ToastSink> {
    toast: T,
}

impl<T: ToastSink> Notifier<T> {
    /// Builds a notifier that delivers through `toast`.
    #[must_use]
    pub fn new(toast: T) -> Self {
        Self { toast }
    }

    /// Shows a toast; when the system refuses it, pushes the fallback event instead.
    pub fn send(&self, bus: &EventBus, notification: &Notification) -> ApiResult<Outcome> {
        match self.toast.show(&notification.title, &notification.body) {
            Ok(()) => Ok(Outcome::Toast),
            Err(reason) => {
                bus.emit_notification_fallback(NotificationFallback {
                    kind: notification.kind,
                    reason,
                })?;

                Ok(Outcome::Fallback)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::event_bus::{names, EventSink};
    use crate::utils::response::{ApiCode, ApiError};
    use std::sync::{Arc, Mutex};

    #[derive(Clone)]
    struct FakeToast(Result<(), String>);

    impl ToastSink for FakeToast {
        fn show(&self, _title: &str, _body: &str) -> Result<(), String> {
            self.0.clone()
        }
    }

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
    fn a_shown_toast_does_not_touch_the_bus() {
        let recorder = Recorder::default();
        let bus = EventBus::new(recorder.clone());
        let notifier = Notifier::new(FakeToast(Ok(())));

        let outcome = notifier
            .send(&bus, &Notification::test(Language::EnUs))
            .expect("the toast is shown");

        assert_eq!(outcome, Outcome::Toast);
        assert!(recorder.pushed().is_empty());
    }

    #[test]
    fn a_refused_toast_falls_back_to_the_bus() {
        let recorder = Recorder::default();
        let bus = EventBus::new(recorder.clone());
        let notifier = Notifier::new(FakeToast(Err("toasts are disabled".to_owned())));

        let outcome = notifier
            .send(&bus, &Notification::test(Language::EnUs))
            .expect("the fallback is pushed");

        assert_eq!(outcome, Outcome::Fallback);

        let pushed = recorder.pushed();
        assert_eq!(pushed.len(), 1);
        assert_eq!(pushed[0].0, names::NOTIFICATION_FALLBACK);
        assert_eq!(pushed[0].1["kind"], serde_json::json!("test"));
        assert_eq!(
            pushed[0].1["reason"],
            serde_json::json!("toasts are disabled")
        );
    }

    #[test]
    fn a_refusing_bus_surfaces_as_an_error() {
        let bus = EventBus::new(RefusingSink);
        let notifier = Notifier::new(FakeToast(Err("toasts are disabled".to_owned())));

        let error = notifier
            .send(&bus, &Notification::test(Language::EnUs))
            .expect_err("the fallback cannot be pushed");

        assert_eq!(error.code(), ApiCode::Internal);
    }

    #[test]
    fn the_pomodoro_copy_follows_the_language_and_the_phase() {
        for phase in Phase::ALL {
            let english = Notification::pomodoro(Language::EnUs, phase);
            let chinese = Notification::pomodoro(Language::ZhCn, phase);

            assert_eq!(english.kind, NotificationKind::Pomodoro);
            assert!(!english.title.is_empty());
            assert!(!english.body.is_empty());
            assert_ne!(english.title, chinese.title, "{phase:?} is not translated");
        }
    }

    #[test]
    fn the_test_copy_is_translated() {
        let english = Notification::test(Language::EnUs);
        let chinese = Notification::test(Language::ZhCn);

        assert_eq!(english.kind, NotificationKind::Test);
        assert_eq!(english.title, "SentryNeko");
        assert!(!english.body.is_empty());
        assert_ne!(english.body, chinese.body);
    }
}
