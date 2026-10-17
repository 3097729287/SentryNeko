//! Tag commands: the name index, the task links and the reverse lookup.

use tauri::State;

use crate::db::connection::Db;
use crate::models::tag::Tag;
use crate::models::todo::Todo;
use crate::utils::response::ApiResponse;

/// Lists every tag, alphabetical.
#[tauri::command]
pub fn list_tags(db: State<'_, Db>) -> ApiResponse<Vec<Tag>> {
    Tag::list(&db).into()
}

/// Creates a tag from a name.
#[tauri::command]
pub fn add_tag(db: State<'_, Db>, name: String) -> ApiResponse<Tag> {
    Tag::add(&db, &name).into()
}

/// Renames a tag.
#[tauri::command]
pub fn rename_tag(db: State<'_, Db>, id: i64, name: String) -> ApiResponse<Tag> {
    Tag::rename(&db, id, &name).into()
}

/// Deletes a tag; the tasks that carried it lose its id.
#[tauri::command]
pub fn delete_tag(db: State<'_, Db>, id: i64) -> ApiResponse<()> {
    Tag::delete(&db, id).into()
}

/// Replaces the tags of a task.
#[tauri::command]
pub fn set_todo_tags(db: State<'_, Db>, id: i64, tag_ids: Vec<i64>) -> ApiResponse<Todo> {
    Todo::set_tags(&db, id, &tag_ids).into()
}

/// Tags of one task.
#[tauri::command]
pub fn todo_tags(db: State<'_, Db>, todo_id: i64) -> ApiResponse<Vec<Tag>> {
    Tag::for_todo(&db, todo_id).into()
}

/// Tasks carrying one tag.
#[tauri::command]
pub fn todos_with_tag(db: State<'_, Db>, tag_id: i64) -> ApiResponse<Vec<Todo>> {
    Todo::list_by_tag(&db, tag_id).into()
}
