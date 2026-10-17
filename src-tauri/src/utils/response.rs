//! Response envelope for Tauri commands; the convention lives in docs/commands.md.

use std::fmt;

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApiCode {
    Ok,
    InvalidInput,
    NotFound,
    Conflict,
    Database,
    Io,
    PermissionDenied,
    Unsupported,
    Internal,
}

impl ApiCode {
    #[must_use]
    pub const fn is_ok(self) -> bool {
        matches!(self, Self::Ok)
    }

    #[must_use]
    pub const fn default_message(self) -> &'static str {
        match self {
            Self::Ok => "OK",
            Self::InvalidInput => "Invalid input",
            Self::NotFound => "Record not found",
            Self::Conflict => "Conflicting state",
            Self::Database => "Database error",
            Self::Io => "I/O error",
            Self::PermissionDenied => "Operation denied by the system",
            Self::Unsupported => "Not supported yet",
            Self::Internal => "Internal error",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiError {
    code: ApiCode,
    message: String,
    details: Option<String>,
}

impl ApiError {
    #[must_use]
    pub fn new(code: ApiCode) -> Self {
        Self {
            code,
            message: code.default_message().to_owned(),
            details: None,
        }
    }

    #[must_use]
    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new(ApiCode::InvalidInput).with_message(message)
    }

    #[must_use]
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ApiCode::NotFound).with_message(message)
    }

    #[must_use]
    pub fn unsupported(message: impl Into<String>) -> Self {
        Self::new(ApiCode::Unsupported).with_message(message)
    }

    #[must_use]
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ApiCode::Internal).with_message(message)
    }

    #[must_use]
    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = message.into();
        self
    }

    #[must_use]
    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }

    #[must_use]
    pub const fn code(&self) -> ApiCode {
        self.code
    }

    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    #[must_use]
    pub fn details(&self) -> Option<&str> {
        self.details.as_deref()
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{:?}: {}", self.code, self.message)?;
        if let Some(details) = &self.details {
            write!(formatter, " ({details})")?;
        }
        Ok(())
    }
}

impl std::error::Error for ApiError {}

impl From<std::io::Error> for ApiError {
    fn from(error: std::io::Error) -> Self {
        Self::new(ApiCode::Io).with_details(error.to_string())
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(error: serde_json::Error) -> Self {
        Self::new(ApiCode::Internal).with_details(error.to_string())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ApiResponse<T> {
    pub code: ApiCode,
    pub message: String,
    pub details: Option<String>,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    #[must_use]
    pub fn ok(data: T) -> Self {
        Self {
            code: ApiCode::Ok,
            message: ApiCode::Ok.default_message().to_owned(),
            details: None,
            data: Some(data),
        }
    }

    #[must_use]
    pub fn fail(error: ApiError) -> Self {
        Self {
            code: error.code(),
            message: error.message().to_owned(),
            details: error.details().map(str::to_owned),
            data: None,
        }
    }
}

impl ApiResponse<()> {
    #[must_use]
    pub fn done() -> Self {
        Self::ok(())
    }
}

impl<T> From<ApiError> for ApiResponse<T> {
    fn from(error: ApiError) -> Self {
        Self::fail(error)
    }
}

impl<T> From<ApiResult<T>> for ApiResponse<T> {
    fn from(result: ApiResult<T>) -> Self {
        match result {
            Ok(data) => Self::ok(data),
            Err(error) => Self::fail(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ok_response_carries_payload() {
        let response = ApiResponse::ok(42);
        let json = serde_json::to_value(response).expect("response serializes");

        assert_eq!(
            json,
            serde_json::json!({
                "code": "OK",
                "message": "OK",
                "details": null,
                "data": 42,
            })
        );
    }

    #[test]
    fn done_response_has_null_payload() {
        let json = serde_json::to_value(ApiResponse::done()).expect("response serializes");

        assert_eq!(json["code"], serde_json::json!("OK"));
        assert_eq!(json["data"], serde_json::json!(null));
    }

    #[test]
    fn failure_response_drops_payload_and_keeps_code() {
        let response: ApiResponse<Vec<u8>> = ApiError::not_found("todo 7 does not exist").into();
        let json = serde_json::to_value(response).expect("response serializes");

        assert_eq!(json["code"], serde_json::json!("NOT_FOUND"));
        assert_eq!(json["message"], serde_json::json!("todo 7 does not exist"));
        assert_eq!(json["details"], serde_json::json!(null));
        assert_eq!(json["data"], serde_json::json!(null));
    }

    #[test]
    fn io_error_keeps_its_diagnostic_as_details() {
        let error = ApiError::from(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "access to the database directory was denied",
        ));
        let json =
            serde_json::to_value(ApiResponse::<()>::from(error)).expect("response serializes");

        assert_eq!(json["code"], serde_json::json!("IO"));
        assert_eq!(json["message"], serde_json::json!("I/O error"));
        assert_eq!(
            json["details"],
            serde_json::json!("access to the database directory was denied")
        );
    }

    #[test]
    fn api_result_converts_on_both_outcomes() {
        let success: ApiResult<u8> = Ok(7);
        assert_eq!(ApiResponse::from(success).code, ApiCode::Ok);

        let failure: ApiResult<u8> = Err(ApiError::internal("unexpected"));
        let response = ApiResponse::from(failure);
        assert_eq!(response.code, ApiCode::Internal);
        assert_eq!(response.data, None);
    }

    #[test]
    fn codes_serialize_in_screaming_snake_case() {
        let codes = [
            ApiCode::Ok,
            ApiCode::InvalidInput,
            ApiCode::NotFound,
            ApiCode::Conflict,
            ApiCode::Database,
            ApiCode::Io,
            ApiCode::PermissionDenied,
            ApiCode::Unsupported,
            ApiCode::Internal,
        ];
        let names: Vec<String> = codes
            .iter()
            .map(|code| serde_json::to_value(code).expect("code serializes"))
            .map(|value| value.as_str().expect("code is a string").to_owned())
            .collect();

        assert_eq!(
            names,
            [
                "OK",
                "INVALID_INPUT",
                "NOT_FOUND",
                "CONFLICT",
                "DATABASE",
                "IO",
                "PERMISSION_DENIED",
                "UNSUPPORTED",
                "INTERNAL",
            ]
        );
    }

    #[test]
    fn display_reports_code_message_and_details() {
        let error = ApiError::invalid_input("title must not be empty").with_details("len = 0");

        assert_eq!(
            error.to_string(),
            "InvalidInput: title must not be empty (len = 0)"
        );
        assert_eq!(error.code(), ApiCode::InvalidInput);
        assert_eq!(error.message(), "title must not be empty");
        assert_eq!(error.details(), Some("len = 0"));
    }
}
