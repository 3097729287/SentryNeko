//! Todo task model.

use rusqlite::{params, Row};
use serde::Serialize;

use crate::db::connection::Db;
use crate::db::repository;
use crate::utils::response::{ApiError, ApiResult};
use crate::utils::time;

/// Columns every query selects, in the order [`Todo::from_row`] reads them.
const COLUMNS: &str = "id, title, completed, created_at, updated_at, tag_ids";

/// A task the user maintains.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub completed: bool,
    pub created_at: i64,
    pub updated_at: i64,
    /// Ids of the tags the task carries, cached from the `todo_tags` link table.
    pub tag_ids: Vec<i64>,
}

/// Totals shown beside the list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoCounts {
    pub total: i64,
    pub remaining: i64,
    pub completed: i64,
}

impl Todo {
    /// Maps one `todos` row selected with [`COLUMNS`].
    pub fn from_row(row: &Row<'_>) -> ApiResult<Self> {
        Ok(Self {
            id: row.get(0)?,
            title: row.get(1)?,
            completed: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            tag_ids: parse_tag_ids(&row.get::<_, String>(5)?)?,
        })
    }

    /// Lists tasks, open ones first and newest first; `completed` narrows the result.
    pub fn list(db: &Db, completed: Option<bool>) -> ApiResult<Vec<Self>> {
        let condition = match completed {
            None => "",
            Some(false) => " WHERE completed = 0",
            Some(true) => " WHERE completed = 1",
        };
        let sql = format!("SELECT {COLUMNS} FROM todos{condition} ORDER BY completed, id DESC");

        repository::query_all(db, &sql, [], Self::from_row)
    }

    /// Returns one task; a missing id is `NOT_FOUND`.
    pub fn find(db: &Db, id: i64) -> ApiResult<Self> {
        repository::query_one(
            db,
            &format!("SELECT {COLUMNS} FROM todos WHERE id = ?1"),
            [id],
            Self::from_row,
        )
    }

    /// Inserts a task and answers with the stored row; a blank title is `INVALID_INPUT`.
    pub fn add(db: &Db, title: &str) -> ApiResult<Self> {
        let title = validate_title(title)?;
        let now = time::now_seconds();
        let id = repository::insert(
            db,
            "INSERT INTO todos (title, completed, created_at, updated_at) VALUES (?1, 0, ?2, ?2)",
            params![title, now],
        )?;

        Self::find(db, id)
    }

    /// Renames a task; a missing id is `NOT_FOUND`.
    pub fn rename(db: &Db, id: i64, title: &str) -> ApiResult<Self> {
        let title = validate_title(title)?;
        let changed = repository::execute(
            db,
            "UPDATE todos SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, time::now_seconds(), id],
        )?;

        require_changed(changed, id)?;
        Self::find(db, id)
    }

    /// Sets the completion flag; a missing id is `NOT_FOUND`.
    pub fn set_completed(db: &Db, id: i64, completed: bool) -> ApiResult<Self> {
        let changed = repository::execute(
            db,
            "UPDATE todos SET completed = ?1, updated_at = ?2 WHERE id = ?3",
            params![completed, time::now_seconds(), id],
        )?;

        require_changed(changed, id)?;
        Self::find(db, id)
    }

    /// Deletes a task; a missing id is `NOT_FOUND`.
    pub fn delete(db: &Db, id: i64) -> ApiResult<()> {
        let changed = repository::execute(db, "DELETE FROM todos WHERE id = ?1", [id])?;

        require_changed(changed, id)
    }

    /// Replaces the tags of a task; the cached id list and the link table move together.
    pub fn set_tags(db: &Db, id: i64, tag_ids: &[i64]) -> ApiResult<Self> {
        Self::find(db, id)?;

        let mut ids = tag_ids.to_vec();
        ids.sort_unstable();
        ids.dedup();

        for tag_id in &ids {
            let known = repository::exists(db, "SELECT 1 FROM tags WHERE id = ?1", [*tag_id])?;

            if !known {
                return Err(ApiError::not_found(format!("no tag with id {tag_id}")));
            }
        }

        let stored = serde_json::to_string(&ids)?;

        repository::transaction(db, |transaction| {
            transaction.execute(
                "UPDATE todos SET tag_ids = ?1, updated_at = ?2 WHERE id = ?3",
                params![stored, time::now_seconds(), id],
            )?;
            transaction.execute("DELETE FROM todo_tags WHERE todo_id = ?1", [id])?;

            for tag_id in &ids {
                transaction.execute(
                    "INSERT INTO todo_tags (todo_id, tag_id) VALUES (?1, ?2)",
                    params![id, tag_id],
                )?;
            }

            Ok(())
        })?;

        Self::find(db, id)
    }

    /// Lists the tasks carrying one tag; the reverse lookup through the link table.
    pub fn list_by_tag(db: &Db, tag_id: i64) -> ApiResult<Vec<Self>> {
        repository::query_all(
            db,
            &format!(
                "SELECT {COLUMNS} FROM todos
                   INNER JOIN todo_tags ON todo_tags.todo_id = todos.id
                  WHERE todo_tags.tag_id = ?1
                  ORDER BY completed, id DESC"
            ),
            [tag_id],
            Self::from_row,
        )
    }
}

/// Reads the cached id list; a malformed column is reported as `INTERNAL`.
fn parse_tag_ids(raw: &str) -> ApiResult<Vec<i64>> {
    serde_json::from_str(raw).map_err(|error| {
        ApiError::internal("the cached tag ids are not a JSON array of numbers")
            .with_details(error.to_string())
    })
}

impl TodoCounts {
    /// Counts every task and how many of them are still open.
    pub fn load(db: &Db) -> ApiResult<Self> {
        repository::query_one(
            db,
            "SELECT COUNT(*), SUM(completed = 0) FROM todos",
            [],
            |row| {
                let total = row.get::<_, i64>(0)?;
                let remaining = row.get::<_, Option<i64>>(1)?.unwrap_or_default();

                Ok(Self {
                    total,
                    remaining,
                    completed: total - remaining,
                })
            },
        )
    }
}

/// Trims the title and rejects an empty result.
fn validate_title(title: &str) -> ApiResult<String> {
    let trimmed = title.trim();

    if trimmed.is_empty() {
        return Err(ApiError::invalid_input("title must not be empty"));
    }

    Ok(trimmed.to_owned())
}

fn require_changed(changed: usize, id: i64) -> ApiResult<()> {
    if changed == 0 {
        return Err(ApiError::not_found(format!("no todo with id {id}")));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use crate::utils::response::ApiCode;

    fn migrated() -> Db {
        let db = Db::open_in_memory().expect("in-memory database opens");
        schema::ensure(&db).expect("schema is created");
        db
    }

    #[test]
    fn add_trims_the_title_and_rejects_a_blank_one() {
        let db = migrated();

        let todo = Todo::add(&db, "  write the docs  ").expect("the task is stored");
        assert_eq!(todo.title, "write the docs");
        assert!(!todo.completed);
        assert_eq!(todo.created_at, todo.updated_at);

        let error = Todo::add(&db, "   ").expect_err("a blank title is refused");
        assert_eq!(error.code(), ApiCode::InvalidInput);
        assert_eq!(Todo::list(&db, None).expect("list").len(), 1);
    }

    #[test]
    fn list_puts_open_tasks_first_and_filters_by_completion() {
        let db = migrated();

        let first = Todo::add(&db, "first").expect("stored");
        Todo::add(&db, "second").expect("stored");
        Todo::set_completed(&db, first.id, true).expect("completed");

        let all = Todo::list(&db, None).expect("list");
        assert_eq!(
            all.iter()
                .map(|todo| todo.title.as_str())
                .collect::<Vec<_>>(),
            ["second", "first"]
        );

        let open = Todo::list(&db, Some(false)).expect("list");
        assert_eq!(open.len(), 1);
        assert_eq!(open[0].title, "second");

        let done = Todo::list(&db, Some(true)).expect("list");
        assert_eq!(done.len(), 1);
        assert_eq!(done[0].title, "first");
    }

    #[test]
    fn rename_and_set_completed_touch_the_stored_row() {
        let db = migrated();
        let todo = Todo::add(&db, "draft").expect("stored");

        let renamed = Todo::rename(&db, todo.id, " final ").expect("renamed");
        assert_eq!(renamed.title, "final");
        assert!(renamed.updated_at >= todo.updated_at);

        let completed = Todo::set_completed(&db, todo.id, true).expect("completed");
        assert!(completed.completed);
        assert_eq!(Todo::find(&db, todo.id).expect("found"), completed);
    }

    #[test]
    fn unknown_ids_report_not_found() {
        let db = migrated();

        for result in [
            Todo::rename(&db, 404, "x").map(|_| ()),
            Todo::set_completed(&db, 404, true).map(|_| ()),
            Todo::delete(&db, 404),
            Todo::find(&db, 404).map(|_| ()),
        ] {
            assert_eq!(result.expect_err("missing id").code(), ApiCode::NotFound);
        }
    }

    #[test]
    fn counts_follow_the_stored_rows() {
        let db = migrated();

        assert_eq!(
            TodoCounts::load(&db).expect("counts"),
            TodoCounts {
                total: 0,
                remaining: 0,
                completed: 0
            }
        );

        let first = Todo::add(&db, "first").expect("stored");
        Todo::add(&db, "second").expect("stored");
        Todo::set_completed(&db, first.id, true).expect("completed");

        assert_eq!(
            TodoCounts::load(&db).expect("counts"),
            TodoCounts {
                total: 2,
                remaining: 1,
                completed: 1
            }
        );

        Todo::delete(&db, first.id).expect("deleted");
        assert_eq!(
            TodoCounts::load(&db).expect("counts"),
            TodoCounts {
                total: 1,
                remaining: 1,
                completed: 0
            }
        );
    }

    #[test]
    fn set_tags_sorts_dedups_and_keeps_the_link_table_in_step() {
        let db = migrated();
        let todo = Todo::add(&db, "tagged").expect("stored");
        let work = crate::models::tag::Tag::add(&db, "work").expect("stored");
        let home = crate::models::tag::Tag::add(&db, "home").expect("stored");

        let tagged = Todo::set_tags(&db, todo.id, &[work.id, home.id, work.id]).expect("linked");
        assert_eq!(
            tagged.tag_ids,
            [work.id, home.id],
            "ids are sorted and deduplicated"
        );
        assert_eq!(
            repository::count(&db, "SELECT COUNT(*) FROM todo_tags", []).expect("count"),
            2
        );

        let cleared = Todo::set_tags(&db, todo.id, &[]).expect("cleared");
        assert!(cleared.tag_ids.is_empty());
        assert_eq!(
            repository::count(&db, "SELECT COUNT(*) FROM todo_tags", []).expect("count"),
            0
        );
    }

    #[test]
    fn set_tags_rejects_unknown_ids_and_malformed_caches_are_reported() {
        let db = migrated();
        let todo = Todo::add(&db, "tagged").expect("stored");

        let unknown_tag = Todo::set_tags(&db, todo.id, &[404]).expect_err("unknown tag");
        assert_eq!(unknown_tag.code(), ApiCode::NotFound);

        let unknown_todo = Todo::set_tags(&db, 404, &[]).expect_err("unknown task");
        assert_eq!(unknown_todo.code(), ApiCode::NotFound);

        repository::execute(
            &db,
            "UPDATE todos SET tag_ids = 'not json' WHERE id = ?1",
            [todo.id],
        )
        .expect("the cache is overwritten by hand");

        let error = Todo::find(&db, todo.id).expect_err("the cache cannot be read");
        assert_eq!(error.code(), ApiCode::Internal);
        assert!(error.details().is_some());
    }
}
