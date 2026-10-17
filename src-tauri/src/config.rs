//! Application configuration: database location, active language and user settings.

use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use serde::{Deserialize, Serialize};

use crate::db::connection::DATABASE_FILE_NAME;
use crate::services::i18n::Language;
use crate::utils::response::{ApiCode, ApiError, ApiResult};

/// Configuration file created inside the application data directory.
pub const CONFIG_FILE_NAME: &str = "config.json";

/// Shape of `config.json`; an absent field falls back to its default.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredConfig {
    #[serde(default)]
    database_path: Option<PathBuf>,
    #[serde(default)]
    language: String,
}

/// Configuration as the application runs it, with every default resolved.
#[derive(Debug, Clone, PartialEq, Eq)]
struct AppConfig {
    database_path: PathBuf,
    language: Language,
}

/// Loads, holds and rewrites `config.json`; share it through Tauri managed state.
///
/// Cloning hands out another handle to the same file and the same value, so a background service
/// that needs the interface language reads the one the settings page writes.
#[derive(Debug, Clone)]
pub struct Config {
    path: Arc<PathBuf>,
    current: Arc<RwLock<AppConfig>>,
}

impl Config {
    /// Reads the configuration, creating it from defaults when it does not exist yet.
    pub fn open(directory: impl AsRef<Path>) -> ApiResult<Self> {
        let directory = directory.as_ref();
        std::fs::create_dir_all(directory)
            .map_err(|error| io_error("create directory", directory, &error))?;

        let path = directory.join(CONFIG_FILE_NAME);
        let (stored, exists) = match std::fs::read_to_string(&path) {
            Ok(contents) => (parse(&path, &contents)?, true),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                (StoredConfig::default(), false)
            }
            Err(error) => return Err(io_error("read", &path, &error)),
        };

        let config = Self {
            path: Arc::new(path),
            current: Arc::new(RwLock::new(stored.resolve(directory))),
        };

        if !exists {
            config.persist(&config.snapshot()?)?;
        }

        Ok(config)
    }

    /// Path of the configuration file itself.
    #[must_use]
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Database file the application opens.
    pub fn database_path(&self) -> ApiResult<PathBuf> {
        Ok(self.snapshot()?.database_path)
    }

    /// Language in force.
    pub fn language(&self) -> ApiResult<Language> {
        Ok(self.snapshot()?.language)
    }

    /// Persists `language` and returns the language it replaced.
    pub fn set_language(&self, language: Language) -> ApiResult<Language> {
        let mut current = self.current.write().map_err(|_| lock_error("write"))?;
        let previous = current.language;

        if previous != language {
            let updated = AppConfig {
                language,
                ..current.clone()
            };
            self.persist(&updated)?;
            *current = updated;
        }

        Ok(previous)
    }

    fn snapshot(&self) -> ApiResult<AppConfig> {
        self.current
            .read()
            .map_err(|_| lock_error("read"))
            .map(|current| current.clone())
    }

    /// Writes beside the target and swaps, so a crash cannot truncate the file.
    fn persist(&self, config: &AppConfig) -> ApiResult<()> {
        let stored = StoredConfig::from(config);
        let contents = serde_json::to_string_pretty(&stored).map_err(|error| {
            ApiError::new(ApiCode::Internal)
                .with_details(format!("serialize {}: {error}", self.path.display()))
        })?;

        let temporary = self.path.with_extension("json.tmp");
        std::fs::write(&temporary, format!("{contents}\n"))
            .map_err(|error| io_error("write", &temporary, &error))?;
        std::fs::rename(&temporary, self.path.as_path()).map_err(|error| {
            let _ = std::fs::remove_file(&temporary);
            io_error("replace", &self.path, &error)
        })
    }
}

impl StoredConfig {
    fn resolve(self, directory: &Path) -> AppConfig {
        let database_path = match self.database_path {
            Some(path) if path.is_absolute() => path,
            Some(path) => directory.join(path),
            None => directory.join(DATABASE_FILE_NAME),
        };

        AppConfig {
            database_path,
            language: Language::from_code(&self.language).unwrap_or(Language::DEFAULT),
        }
    }
}

impl From<&AppConfig> for StoredConfig {
    fn from(config: &AppConfig) -> Self {
        Self {
            database_path: Some(config.database_path.clone()),
            language: config.language.code().to_owned(),
        }
    }
}

fn parse(path: &Path, contents: &str) -> ApiResult<StoredConfig> {
    serde_json::from_str(contents).map_err(|error| {
        ApiError::new(ApiCode::Io).with_details(format!("parse {}: {error}", path.display()))
    })
}

fn io_error(action: &str, path: &Path, error: &std::io::Error) -> ApiError {
    ApiError::new(ApiCode::Io).with_details(format!("{action} {}: {error}", path.display()))
}

fn lock_error(action: &str) -> ApiError {
    ApiError::internal(format!("the configuration lock is poisoned ({action})"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::DATABASE_FILE_NAME;
    use tempfile::TempDir;

    fn temporary_directory() -> TempDir {
        tempfile::tempdir().expect("a temporary directory is created")
    }

    fn write_config(directory: &Path, contents: &str) -> PathBuf {
        let path = directory.join(CONFIG_FILE_NAME);
        std::fs::write(&path, contents).expect("the configuration is written");

        path
    }

    #[test]
    fn first_run_creates_the_configuration() {
        let directory = temporary_directory();
        let config = Config::open(directory.path()).expect("the configuration is created");

        assert_eq!(config.path(), directory.path().join(CONFIG_FILE_NAME));
        assert_eq!(
            config.database_path().expect("database path"),
            directory.path().join(DATABASE_FILE_NAME)
        );
        assert_eq!(config.language().expect("language"), Language::DEFAULT);

        let stored: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(config.path()).expect("the configuration is readable"),
        )
        .expect("the configuration is json");

        assert_eq!(
            stored["databasePath"],
            serde_json::json!(directory.path().join(DATABASE_FILE_NAME).to_string_lossy())
        );
        assert_eq!(stored["language"], serde_json::json!("en-US"));
    }

    #[test]
    fn configuration_survives_a_restart() {
        let directory = temporary_directory();

        {
            let config = Config::open(directory.path()).expect("the configuration is created");
            assert_eq!(
                config
                    .set_language(Language::ZhCn)
                    .expect("language is written"),
                Language::DEFAULT
            );
            assert_eq!(config.language().expect("language"), Language::ZhCn);
        }

        let reopened = Config::open(directory.path()).expect("the configuration is read back");
        assert_eq!(reopened.language().expect("language"), Language::ZhCn);
    }

    #[test]
    fn a_configured_database_path_is_used() {
        let directory = temporary_directory();
        let elsewhere = temporary_directory();

        write_config(
            directory.path(),
            r#"{ "databasePath": "data\\library.db", "language": "zh-CN" }"#,
        );
        let relative = Config::open(directory.path()).expect("the configuration is read");
        assert_eq!(
            relative.database_path().expect("database path"),
            directory.path().join("data").join("library.db")
        );
        assert_eq!(relative.language().expect("language"), Language::ZhCn);

        write_config(
            directory.path(),
            &format!(
                r#"{{ "databasePath": "{}" }}"#,
                elsewhere
                    .path()
                    .join("library.db")
                    .display()
                    .to_string()
                    .replace('\\', "\\\\")
            ),
        );
        let absolute = Config::open(directory.path()).expect("the configuration is read");
        assert_eq!(
            absolute.database_path().expect("database path"),
            elsewhere.path().join("library.db")
        );
    }

    #[test]
    fn missing_fields_and_unknown_languages_fall_back() {
        let directory = temporary_directory();
        write_config(directory.path(), r#"{ "language": "ja-JP" }"#);

        let config = Config::open(directory.path()).expect("the configuration is read");

        assert_eq!(config.language().expect("language"), Language::DEFAULT);
        assert_eq!(
            config.database_path().expect("database path"),
            directory.path().join(DATABASE_FILE_NAME)
        );
    }

    #[test]
    fn a_malformed_configuration_is_reported_and_left_alone() {
        let directory = temporary_directory();
        let path = write_config(directory.path(), "{ not json");

        let error = Config::open(directory.path()).expect_err("the configuration is rejected");

        assert_eq!(error.code(), ApiCode::Io);
        assert!(
            error.details().expect("details").contains(CONFIG_FILE_NAME),
            "details name the file: {error:?}"
        );
        assert_eq!(
            std::fs::read_to_string(path).expect("the configuration is readable"),
            "{ not json"
        );
    }
}
