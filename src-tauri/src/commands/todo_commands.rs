//! Todo CRUD commands.

use tauri::State;

use crate::db::connection::Db;
use crate::models::todo::{Todo, TodoCounts};
use crate::utils::response::ApiResponse;

/// Lists tasks, open ones first; `completed` narrows the result.
#[tauri::command]
pub fn list_todos(db: State<'_, Db>, completed: Option<bool>) -> ApiResponse<Vec<Todo>> {
    Todo::list(&db, completed).into()
}

/// Creates a task from a title.
#[tauri::command]
pub fn add_todo(db: State<'_, Db>, title: String) -> ApiResponse<Todo> {
    Todo::add(&db, &title).into()
}

/// Renames a task.
#[tauri::command]
pub fn rename_todo(db: State<'_, Db>, id: i64, title: String) -> ApiResponse<Todo> {
    Todo::rename(&db, id, &title).into()
}

/// Sets the completion flag of a task.
#[tauri::command]
pub fn set_todo_completed(db: State<'_, Db>, id: i64, completed: bool) -> ApiResponse<Todo> {
    Todo::set_completed(&db, id, completed).into()
}

/// Deletes a task.
#[tauri::command]
pub fn delete_todo(db: State<'_, Db>, id: i64) -> ApiResponse<()> {
    Todo::delete(&db, id).into()
}

/// Counts every task and how many are still open.
#[tauri::command]
pub fn todo_counts(db: State<'_, Db>) -> ApiResponse<TodoCounts> {
    TodoCounts::load(&db).into()
}
