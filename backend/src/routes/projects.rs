use axum::{
    extract::{Path, State},
    Json,
};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    models::project::{CreateProject, Project, UpdateProject},
};

const LIST_PROJECTS_SQL: &str =
    "SELECT id, name, key, description, created_at, updated_at FROM projects ORDER BY created_at DESC";
const GET_PROJECT_SQL: &str =
    "SELECT id, name, key, description, created_at, updated_at FROM projects WHERE id = ?";

pub async fn list_projects(State(pool): State<SqlitePool>) -> Result<Json<Vec<Project>>> {
    let projects = sqlx::query_as::<_, Project>(LIST_PROJECTS_SQL)
        .fetch_all(&pool)
        .await?;
    Ok(Json(projects))
}

pub async fn create_project(
    State(pool): State<SqlitePool>,
    Json(body): Json<CreateProject>,
) -> Result<Json<Project>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }
    if body.key.trim().is_empty() {
        return Err(AppError::BadRequest("key is required".to_string()));
    }
    if !body.key.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(AppError::BadRequest(
            "key must be alphanumeric".to_string(),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let key = body.key.to_uppercase();

    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (id, name, key, description) VALUES (?, ?, ?, ?) RETURNING id, name, key, description, created_at, updated_at",
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&key)
    .bind(&body.description)
    .fetch_one(&pool)
    .await?;

    Ok(Json(project))
}

pub async fn get_project(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Project>> {
    let project = sqlx::query_as::<_, Project>(GET_PROJECT_SQL)
        .bind(&id)
        .fetch_optional(&pool)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(project))
}

pub async fn update_project(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(body): Json<UpdateProject>,
) -> Result<Json<Project>> {
    let current = sqlx::query_as::<_, Project>(GET_PROJECT_SQL)
        .bind(&id)
        .fetch_optional(&pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let name = body.name.unwrap_or(current.name);
    let description = body.description.or(current.description);

    let updated = sqlx::query_as::<_, Project>(
        "UPDATE projects SET name=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING id, name, key, description, created_at, updated_at",
    )
    .bind(&name)
    .bind(&description)
    .bind(&id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}

pub async fn delete_project(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    // Verify the project exists before starting the transaction
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?)")
            .bind(&id)
            .fetch_one(&pool)
            .await?;
    if !exists {
        return Err(AppError::NotFound);
    }

    let mut tx = pool.begin().await?;

    // Delete in dependency order: activity_logs and comments are CASCADE-deleted
    // with issues, but issues must be deleted before sprints and projects.
    sqlx::query("DELETE FROM issues WHERE project_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM sprints WHERE project_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
