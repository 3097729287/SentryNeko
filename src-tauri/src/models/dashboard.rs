//! Dashboard layout: which widgets the home page shows, which cells each one takes and how a
//! re-arrangement reaches the store.
//!
//! The page is a grid of two columns. Every placed widget has an identity of its own, so the same
//! kind can appear several times — two todo cards, two timers, whatever the user wants. Because of
//! that, the frontend does not send the whole layout on every drag: it sends the changes one
//! arrangement produced (`WidgetChange`), which this module applies to the stored layout, validates
//! and hands back.
//!
//! The widget catalogue belongs to the frontend, so a remark here is only what the backend can
//! check without knowing the pages: one identity per entry, cells inside the grid, and a sane
//! length for the whole list.

use std::collections::HashSet;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::connection::Db;
use crate::db::repository;
use crate::utils::response::{ApiError, ApiResult};
use crate::utils::time;

/// Key of the layout row in the `settings` table. A new key, because the order-based layout of the
/// first build cannot be read as cell coordinates; that row is simply left behind.
const LAYOUT_KEY: &str = "dashboard.grid";

/// Widest a widget id or kind may get, so a corrupt file cannot bloat the row.
const MAX_NAME_LENGTH: usize = 32;

/// Most widgets one dashboard may hold; a guard against runaway files, not a product limit.
const MAX_WIDGETS: usize = 24;

/// Columns the dashboard grid has; the page draws the same number.
const GRID_COLUMNS: u32 = 2;

/// Tallest a widget may get, in rows.
const MAX_WIDGET_HEIGHT: u32 = 3;

/// Deepest a widget may start, so a corrupt row cannot open an endless grid.
const MAX_GRID_ROWS: u32 = 32;

/// One placed widget: its identity, what it draws, the cells it takes and where it reads from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardWidget {
    /// Identity of this placement; unique inside the layout, while `kind` may repeat.
    #[serde(default)]
    pub id: String,
    /// Widget type, drawn by the page; the same kind may be placed several times.
    pub kind: String,
    /// Column of the top-left cell, 0-based.
    #[serde(default)]
    pub x: u32,
    /// Row of the top-left cell, 0-based.
    #[serde(default)]
    pub y: u32,
    /// Cells across, 1..=2.
    #[serde(default = "one")]
    pub w: u32,
    /// Cells down, 1..=3.
    #[serde(default = "one")]
    pub h: u32,
    /// Data-source preset of the kind; empty for widgets that have nothing to choose.
    #[serde(default)]
    pub source: String,
}

/// One thing a re-arrangement did: a widget moved, resized or added, or one was removed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum WidgetChange {
    /// Adds the widget, or replaces the one with the same id.
    Upsert { widget: DashboardWidget },
    /// Drops the widget with this id; removing an absent id is a no-op.
    Remove { id: String },
}

/// Default span of a widget, so a row written before the grid still opens.
fn one() -> u32 {
    1
}

/// The whole dashboard, a widget per placement.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardLayout {
    #[serde(default)]
    pub widgets: Vec<DashboardWidget>,
}

impl DashboardLayout {
    /// Reads the stored layout; `None` means the user has never customised the dashboard.
    ///
    /// A row written before widgets had identities is given one per position and stored back, so
    /// the next change set can address it.
    pub fn load(db: &Db) -> ApiResult<Option<Self>> {
        let stored = repository::query_optional(
            db,
            "SELECT value FROM settings WHERE key = ?1",
            [LAYOUT_KEY],
            |row| Ok(row.get::<_, String>(0)?),
        )?;

        match stored {
            Some(raw) => {
                let mut layout: Self = serde_json::from_str(&raw)?;

                if layout.name_unnamed() {
                    layout.validate()?;
                    layout.store(db)?;
                }

                Ok(Some(layout))
            }
            None => Ok(None),
        }
    }

    /// Applies one arrangement's changes and answers with the layout now in force.
    pub fn apply(db: &Db, changes: Vec<WidgetChange>) -> ApiResult<Self> {
        let mut layout = Self::load(db)?.unwrap_or_default();

        for change in changes {
            match change {
                WidgetChange::Upsert { widget } => {
                    match layout.widgets.iter_mut().find(|item| item.id == widget.id) {
                        Some(existing) => *existing = widget,
                        None => layout.widgets.push(widget),
                    }
                }
                WidgetChange::Remove { id } => layout.widgets.retain(|item| item.id != id),
            }
        }

        layout.validate()?;
        layout.store(db)
    }

    /// Validates and stores the layout, answering with what was written.
    pub fn save(db: &Db, layout: Self) -> ApiResult<Self> {
        layout.validate()?;
        layout.store(db)
    }

    /// Writes the layout as it stands; callers have validated it already.
    fn store(&self, db: &Db) -> ApiResult<Self> {
        repository::execute(
            db,
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![
                LAYOUT_KEY,
                serde_json::to_string(self)?,
                time::now_seconds()
            ],
        )?;

        Ok(self.clone())
    }

    /// Gives each unnamed widget `kind-position`, the same rule the frontend applies to old rows.
    fn name_unnamed(&mut self) -> bool {
        let mut changed = false;

        for (index, widget) in self.widgets.iter_mut().enumerate() {
            if widget.id.trim().is_empty() {
                widget.id = format!("{}-{index}", widget.kind);
                changed = true;
            }
        }

        changed
    }

    fn validate(&self) -> ApiResult<()> {
        if self.widgets.len() > MAX_WIDGETS {
            return Err(ApiError::invalid_input(format!(
                "a dashboard holds at most {MAX_WIDGETS} widgets"
            ))
            .with_details(format!("received {}", self.widgets.len())));
        }

        let mut ids = HashSet::new();

        for widget in &self.widgets {
            check_name("id", &widget.id)?;
            check_name("kind", &widget.kind)?;

            if !ids.insert(widget.id.as_str()) {
                return Err(ApiError::invalid_input(format!(
                    "the widget id {} appears twice",
                    widget.id
                )));
            }

            if widget.w == 0 || widget.w > GRID_COLUMNS {
                return Err(ApiError::invalid_input(format!(
                    "widget {} has an impossible width: {}",
                    widget.id, widget.w
                ))
                .with_details(format!("the grid is {GRID_COLUMNS} columns wide")));
            }

            if widget.h == 0 || widget.h > MAX_WIDGET_HEIGHT {
                return Err(ApiError::invalid_input(format!(
                    "widget {} has an impossible height: {}",
                    widget.id, widget.h
                ))
                .with_details(format!("a widget spans 1 to {MAX_WIDGET_HEIGHT} rows")));
            }

            if widget.x.saturating_add(widget.w) > GRID_COLUMNS {
                return Err(ApiError::invalid_input(format!(
                    "widget {} starts outside the grid",
                    widget.id
                ))
                .with_details(format!(
                    "a widget of width {} has to start in column 0 or 1",
                    widget.w
                )));
            }

            if widget.y.saturating_add(widget.h) > MAX_GRID_ROWS {
                return Err(ApiError::invalid_input(format!(
                    "widget {} reaches past the last row",
                    widget.id
                ))
                .with_details(format!("the grid is {MAX_GRID_ROWS} rows deep")));
            }

            if widget.source.len() > MAX_NAME_LENGTH {
                return Err(ApiError::invalid_input(format!(
                    "source of {} must be at most {MAX_NAME_LENGTH} characters",
                    widget.id
                ))
                .with_details(format!("received {}", widget.source.len())));
            }
        }

        Ok(())
    }
}

/// Rejects an empty or over-long id or kind.
fn check_name(field: &str, value: &str) -> ApiResult<()> {
    if value.trim().is_empty() {
        return Err(ApiError::invalid_input(format!(
            "{field} must not be empty"
        )));
    }

    if value.len() > MAX_NAME_LENGTH {
        return Err(ApiError::invalid_input(format!(
            "{field} must be at most {MAX_NAME_LENGTH} characters"
        ))
        .with_details(format!("received {}", value.len())));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use crate::utils::response::ApiCode;

    fn created() -> Db {
        let db = Db::open_in_memory().expect("in-memory database opens");
        schema::ensure(&db).expect("schema is created");
        db
    }

    fn widget(id: &str, kind: &str) -> DashboardWidget {
        DashboardWidget {
            id: id.to_owned(),
            kind: kind.to_owned(),
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            source: String::new(),
        }
    }

    fn at(id: &str, kind: &str, x: u32, y: u32, w: u32, h: u32) -> DashboardWidget {
        DashboardWidget {
            id: id.to_owned(),
            kind: kind.to_owned(),
            x,
            y,
            w,
            h,
            source: String::new(),
        }
    }

    fn layout(widgets: Vec<DashboardWidget>) -> DashboardLayout {
        DashboardLayout { widgets }
    }

    fn upsert(widget: DashboardWidget) -> WidgetChange {
        WidgetChange::Upsert { widget }
    }

    #[test]
    fn a_fresh_database_has_no_layout() {
        assert_eq!(
            DashboardLayout::load(&created()).expect("the layout is read"),
            None
        );
    }

    #[test]
    fn changes_are_applied_and_persisted() {
        let db = created();
        let stored = DashboardLayout::apply(
            &db,
            vec![
                upsert(at("focus-1", "focus", 0, 0, 1, 2)),
                upsert(at("todos-1", "todos", 1, 0, 1, 1)),
            ],
        )
        .expect("the changes are applied");

        assert_eq!(
            DashboardLayout::load(&db).expect("the layout is read"),
            Some(stored)
        );
    }

    #[test]
    fn an_upsert_moves_the_widget_it_names() {
        let db = created();

        DashboardLayout::apply(&db, vec![upsert(at("todos-1", "todos", 0, 0, 1, 1))])
            .expect("the widget is added");
        DashboardLayout::apply(&db, vec![upsert(at("todos-1", "todos", 0, 1, 2, 1))])
            .expect("the widget is replaced");

        let stored = DashboardLayout::load(&db)
            .expect("the layout is read")
            .expect("a layout is stored");

        assert_eq!(stored.widgets, vec![at("todos-1", "todos", 0, 1, 2, 1)]);
    }

    #[test]
    fn a_remove_drops_only_that_placement() {
        let db = created();

        DashboardLayout::apply(
            &db,
            vec![
                upsert(widget("todos-1", "todos")),
                upsert(widget("todos-2", "todos")),
            ],
        )
        .expect("both are added");
        DashboardLayout::apply(
            &db,
            vec![WidgetChange::Remove {
                id: "todos-1".to_owned(),
            }],
        )
        .expect("one is removed");

        let stored = DashboardLayout::load(&db)
            .expect("the layout is read")
            .expect("a layout is stored");

        assert_eq!(stored.widgets, vec![widget("todos-2", "todos")]);
    }

    #[test]
    fn one_kind_may_be_placed_several_times() {
        let stored = DashboardLayout::apply(
            &created(),
            vec![
                upsert(at("todos-1", "todos", 0, 0, 1, 1)),
                upsert(at("todos-2", "todos", 1, 0, 1, 1)),
            ],
        )
        .expect("two placements of one kind are accepted");

        assert_eq!(stored.widgets.len(), 2);
    }

    #[test]
    fn one_id_may_appear_only_once() {
        let error = DashboardLayout::save(
            &created(),
            layout(vec![widget("todos-1", "todos"), widget("todos-1", "focus")]),
        )
        .expect_err("the duplicate id is rejected");

        assert_eq!(error.code(), ApiCode::InvalidInput);
        assert!(error.message().contains("todos-1"), "{error:?}");
    }

    #[test]
    fn a_widget_wider_than_the_grid_is_rejected() {
        let error =
            DashboardLayout::save(&created(), layout(vec![at("focus-1", "focus", 0, 0, 3, 1)]))
                .expect_err("the width is rejected");

        assert_eq!(error.code(), ApiCode::InvalidInput);
        assert!(
            error.details().expect("details").contains("columns"),
            "details explain the grid: {error:?}"
        );
    }

    #[test]
    fn a_widget_taller_than_the_grid_is_rejected() {
        let error =
            DashboardLayout::save(&created(), layout(vec![at("focus-1", "focus", 0, 0, 1, 4)]))
                .expect_err("the height is rejected");

        assert_eq!(error.code(), ApiCode::InvalidInput);
    }

    #[test]
    fn a_widget_cannot_start_past_the_last_column() {
        let error =
            DashboardLayout::save(&created(), layout(vec![at("focus-1", "focus", 1, 0, 2, 1)]))
                .expect_err("the placement is rejected");

        assert_eq!(error.code(), ApiCode::InvalidInput);
        assert!(
            error.message().contains("outside"),
            "the message names the problem: {error:?}"
        );
    }

    #[test]
    fn an_empty_id_is_rejected() {
        let error = DashboardLayout::save(&created(), layout(vec![widget("", "focus")]))
            .expect_err("the empty id is rejected");

        assert_eq!(error.code(), ApiCode::InvalidInput);
    }

    #[test]
    fn too_many_widgets_are_rejected() {
        let widgets = (0..=MAX_WIDGETS)
            .map(|index| widget(&format!("focus-{index}"), "focus"))
            .collect();

        let error = DashboardLayout::save(&created(), layout(widgets))
            .expect_err("the oversized layout is rejected");

        assert_eq!(error.code(), ApiCode::InvalidInput);
    }

    #[test]
    fn an_unnamed_row_gets_an_identity_when_it_is_read() {
        let db = created();

        repository::execute(
            &db,
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params![
                LAYOUT_KEY,
                r#"{"widgets":[{"kind":"focus","x":0,"y":0,"w":1,"h":2}]}"#,
                time::now_seconds()
            ],
        )
        .expect("the old row is written");

        let stored = DashboardLayout::load(&db)
            .expect("the layout is read")
            .expect("a layout is stored");

        assert_eq!(stored.widgets, vec![at("focus-0", "focus", 0, 0, 1, 2)]);
    }
}
