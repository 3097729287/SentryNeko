//! SQLite connection pool initialization.

use std::path::Path;
use std::time::Duration;

use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

use crate::utils::response::{ApiCode, ApiError, ApiResult};

/// Database file name inside the application data directory.
pub const DATABASE_FILE_NAME: &str = "sentryneko.db";

/// Pooled SQLite connections.
pub type DbPool = Pool<SqliteConnectionManager>;

/// A connection checked out of the pool.
pub type DbConnection = PooledConnection<SqliteConnectionManager>;

const POOL_MAX_SIZE: u32 = 4;
const POOL_TIMEOUT: Duration = Duration::from_secs(5);
const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

/// Handle to the SQLite database; cloning shares one pool.
#[derive(Clone)]
pub struct Db {
    pool: DbPool,
}

impl Db {
    /// Opens `path`, creating the file and its parent directory when missing.
    pub fn open(path: impl AsRef<Path>) -> ApiResult<Self> {
        let path = path.as_ref();
        if let Some(directory) = path.parent() {
            std::fs::create_dir_all(directory)?;
        }

        Self::pooled(SqliteConnectionManager::file(path))
    }

    /// Opens a private in-memory database.
    pub fn open_in_memory() -> ApiResult<Self> {
        Self::pooled(SqliteConnectionManager::memory())
    }

    fn pooled(manager: SqliteConnectionManager) -> ApiResult<Self> {
        let manager = manager.with_init(|connection: &mut Connection| {
            connection.busy_timeout(BUSY_TIMEOUT)?;
            connection.pragma_update(None, "foreign_keys", true)?;
            connection.pragma_update(None, "synchronous", "NORMAL")?;
            connection.query_row("PRAGMA journal_mode = WAL", [], |_row| Ok(()))?;
            Ok(())
        });

        let pool = Pool::builder()
            .max_size(POOL_MAX_SIZE)
            .connection_timeout(POOL_TIMEOUT)
            .build(manager)?;

        Ok(Self { pool })
    }

    /// Checks a connection out of the pool.
    pub fn connection(&self) -> ApiResult<DbConnection> {
        Ok(self.pool.get()?)
    }

    /// Borrows the shared pool.
    pub const fn pool(&self) -> &DbPool {
        &self.pool
    }
}

impl From<rusqlite::Error> for ApiError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new(ApiCode::Database).with_details(error.to_string())
    }
}

impl From<r2d2::Error> for ApiError {
    fn from(error: r2d2::Error) -> Self {
        Self::new(ApiCode::Database).with_details(format!("connection pool: {error}"))
    }
}
