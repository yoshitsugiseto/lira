use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    models::issue::{
        CreateIssue, Issue, IssueFilters, IssueRow, UpdateIssue, UpdateIssueSprint,
        UpdateIssueStatus,
    },
};

const ISSUE_SELECT: &str =
    "SELECT id, project_id, sprint_id, parent_id, number, title, description, type, status, priority, points, assignee, labels, position, created_at, updated_at FROM issues";
const GET_ISSUE_SQL: &str =
    "SELECT id, project_id, sprint_id, parent_id, number, title, description, type, status, priority, points, assignee, labels, position, created_at, updated_at FROM issues WHERE id = ?";

fn validate_status(status: &str) -> crate::error::Result<()> {
    match status {
        "todo" | "in_progress" | "in_review" | "done" => Ok(()),
        _ => Err(AppError::BadRequest(format!("Invalid status: {status}"))),
    }
}

fn validate_issue_type(t: &str) -> crate::error::Result<()> {
    match t {
        "story" | "task" | "bug" | "spike" => Ok(()),
        _ => Err(AppError::BadRequest(format!("Invalid issue type: {t}"))),
    }
}

fn validate_priority(p: &str) -> crate::error::Result<()> {
    match p {
        "critical" | "high" | "medium" | "low" => Ok(()),
        _ => Err(AppError::BadRequest(format!("Invalid priority: {p}"))),
    }
}

/// WHERE句と引数リストを構築する共通ヘルパー
fn build_issue_where(project_id: &str, filters: &IssueFilters) -> (String, Vec<String>) {
    let mut clause = "WHERE project_id = ?".to_string();
    let mut args: Vec<String> = vec![project_id.to_string()];

    match filters.sprint_id.as_deref() {
        Some("backlog") => clause.push_str(" AND sprint_id IS NULL"),
        Some(sid) => {
            clause.push_str(" AND sprint_id = ?");
            args.push(sid.to_string());
        }
        None => {}
    }
    if let Some(status) = &filters.status {
        clause.push_str(" AND status = ?");
        args.push(status.clone());
    }
    if let Some(t) = &filters.r#type {
        clause.push_str(" AND type = ?");
        args.push(t.clone());
    }
    if let Some(priority) = &filters.priority {
        clause.push_str(" AND priority = ?");
        args.push(priority.clone());
    }
    if let Some(assignee) = &filters.assignee {
        clause.push_str(" AND assignee = ?");
        args.push(assignee.clone());
    }
    if let Some(q) = &filters.q {
        clause.push_str(" AND (title LIKE ? OR description LIKE ?)");
        let pattern = format!("%{}%", q);
        args.push(pattern.clone());
        args.push(pattern);
    }

    (clause, args)
}

pub async fn list_issues(
    State(pool): State<SqlitePool>,
    Path(project_id): Path<String>,
    Query(filters): Query<IssueFilters>,
) -> Result<(HeaderMap, Json<Vec<Issue>>)> {
    let (where_clause, args) = build_issue_where(&project_id, &filters);

    // 総件数クエリ
    let count_sql = format!("SELECT COUNT(*) FROM issues {where_clause}");
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql);
    for arg in &args {
        count_q = count_q.bind(arg);
    }
    let total: i64 = count_q.fetch_one(&pool).await?;

    // データクエリ（limit / offset 適用）
    let limit = filters.limit.unwrap_or(500).clamp(1, 1000);
    let offset = filters.offset.unwrap_or(0).max(0);
    let data_sql = format!(
        "{ISSUE_SELECT} {where_clause} ORDER BY position ASC, created_at DESC LIMIT {limit} OFFSET {offset}"
    );
    let mut data_q = sqlx::query_as::<_, IssueRow>(&data_sql);
    for arg in &args {
        data_q = data_q.bind(arg);
    }
    let rows = data_q.fetch_all(&pool).await?;

    let mut headers = HeaderMap::new();
    headers.insert(
        "X-Total-Count",
        axum::http::HeaderValue::from_str(&total.to_string())
            .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?,
    );

    Ok((headers, Json(rows.into_iter().map(Issue::from).collect())))
}

pub async fn create_issue(
    State(pool): State<SqlitePool>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateIssue>,
) -> Result<Json<Issue>> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".to_string()));
    }
    if body.title.len() > 500 {
        return Err(AppError::BadRequest("title must be 500 characters or fewer".to_string()));
    }
    if body.description.as_deref().map_or(false, |d| d.len() > 10000) {
        return Err(AppError::BadRequest("description must be 10000 characters or fewer".to_string()));
    }

    if body.points.map_or(false, |p| p < 0 || p > 999) {
        return Err(AppError::BadRequest("points must be between 0 and 999".to_string()));
    }

    let id = Uuid::new_v4().to_string();
    let issue_type = body.r#type.unwrap_or_else(|| "task".to_string());
    validate_issue_type(&issue_type)?;
    let priority = body.priority.unwrap_or_else(|| "medium".to_string());
    validate_priority(&priority)?;
    let labels = body.labels.unwrap_or_default();
    if labels.len() > 20 {
        return Err(AppError::BadRequest("labels must be 20 or fewer".to_string()));
    }
    let labels_json = serde_json::to_string(&labels)
        .map_err(|e| AppError::Internal(e.into()))?;

    let mut tx = pool.begin().await?;

    // Validate parent issue exists and is a story
    if let Some(ref parent_id) = body.parent_id {
        let parent_type: Option<String> =
            sqlx::query_scalar("SELECT type FROM issues WHERE id = ? AND project_id = ?")
                .bind(parent_id)
                .bind(&project_id)
                .fetch_optional(&mut *tx)
                .await?;
        match parent_type.as_deref() {
            Some("story") => {}
            Some(_) => {
                return Err(AppError::BadRequest(
                    "Parent issue must be a story".to_string(),
                ))
            }
            None => {
                return Err(AppError::BadRequest(
                    "Parent issue not found".to_string(),
                ))
            }
        }
    }

    let number: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(number), 0) + 1 FROM issues WHERE project_id = ?",
    )
    .bind(&project_id)
    .fetch_one(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, IssueRow>(
        "INSERT INTO issues (id, project_id, sprint_id, parent_id, number, title, description, type, priority, points, assignee, labels) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, project_id, sprint_id, parent_id, number, title, description, type, status, priority, points, assignee, labels, position, created_at, updated_at",
    )
    .bind(&id)
    .bind(&project_id)
    .bind(&body.sprint_id)
    .bind(&body.parent_id)
    .bind(number)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&issue_type)
    .bind(&priority)
    .bind(body.points)
    .bind(body.assignee.as_deref())
    .bind(&labels_json)
    .fetch_one(&mut *tx)
    .await;

    // Fallback: fetch the inserted row
    let row = match row {
        Ok(r) => r,
        Err(_) => {
            sqlx::query_as::<_, IssueRow>(GET_ISSUE_SQL)
                .bind(&id)
                .fetch_one(&mut *tx)
                .await?
        }
    };

    tx.commit().await?;

    Ok(Json(Issue::from(row)))
}

pub async fn get_issue(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Issue>> {
    let row = sqlx::query_as::<_, IssueRow>(GET_ISSUE_SQL)
        .bind(&id)
        .fetch_optional(&pool)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(Issue::from(row)))
}

pub async fn update_issue(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(body): Json<UpdateIssue>,
) -> Result<Json<Issue>> {
    if let Some(ref title) = body.title {
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("title must not be empty".to_string()));
        }
        if title.len() > 500 {
            return Err(AppError::BadRequest("title must be 500 characters or fewer".to_string()));
        }
    }
    if body.description.as_deref().map_or(false, |d| d.len() > 10000) {
        return Err(AppError::BadRequest("description must be 10000 characters or fewer".to_string()));
    }
    if let Some(ref s) = body.status {
        validate_status(s)?;
    }
    if let Some(ref t) = body.r#type {
        validate_issue_type(t)?;
    }
    if let Some(ref p) = body.priority {
        validate_priority(p)?;
    }
    if let Some(ref labels) = body.labels {
        if labels.len() > 20 {
            return Err(AppError::BadRequest("labels must be 20 or fewer".to_string()));
        }
    }
    if let Some(points) = body.points {
        if points < 0 || points > 999 {
            return Err(AppError::BadRequest("points must be between 0 and 999".to_string()));
        }
    }

    let current = sqlx::query_as::<_, IssueRow>(GET_ISSUE_SQL)
        .bind(&id)
        .fetch_optional(&pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let title = body.title.unwrap_or(current.title.clone());
    let description = body.description.or(current.description.clone());
    let issue_type = body.r#type.unwrap_or(current.r#type.clone());
    let new_status = body.status.clone().unwrap_or(current.status.clone());
    let priority = body.priority.unwrap_or(current.priority.clone());
    let points = body.points.or(current.points);
    let assignee = body.assignee.or(current.assignee.clone());
    let labels_json = match body.labels {
        Some(l) => serde_json::to_string(&l).map_err(|e| AppError::Internal(e.into()))?,
        None => current.labels.clone().unwrap_or_else(|| "[]".to_string()),
    };
    let sprint_id = if body.sprint_id.is_some() {
        body.sprint_id.clone()
    } else {
        current.sprint_id.clone()
    };
    let parent_id = if body.parent_id.is_some() {
        body.parent_id.clone()
    } else {
        current.parent_id.clone()
    };

    let mut tx = pool.begin().await?;

    sqlx::query(
        "UPDATE issues SET title=?, description=?, type=?, status=?, priority=?, points=?, assignee=?, labels=?, sprint_id=?, parent_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(&title)
    .bind(&description)
    .bind(&issue_type)
    .bind(&new_status)
    .bind(&priority)
    .bind(points)
    .bind(&assignee)
    .bind(&labels_json)
    .bind(&sprint_id)
    .bind(&parent_id)
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    if body.status.is_some() && body.status.as_deref() != Some(&current.status) {
        let log_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO activity_logs (id, issue_id, field, old_value, new_value) VALUES (?, ?, 'status', ?, ?)",
        )
        .bind(&log_id)
        .bind(&id)
        .bind(&current.status)
        .bind(&new_status)
        .execute(&mut *tx)
        .await?;
    }

    let row = sqlx::query_as::<_, IssueRow>(GET_ISSUE_SQL)
        .bind(&id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(Issue::from(row)))
}

pub async fn delete_issue(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let mut tx = pool.begin().await?;

    // Delete subtasks first to avoid orphaned children
    sqlx::query("DELETE FROM issues WHERE parent_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;

    let result = sqlx::query("DELETE FROM issues WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;

    if result.rows_affected() == 0 {
        tx.rollback().await?;
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn update_issue_status(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(body): Json<UpdateIssueStatus>,
) -> Result<Json<Issue>> {
    validate_status(&body.status)?;

    let current = sqlx::query_as::<_, IssueRow>(GET_ISSUE_SQL)
        .bind(&id)
        .fetch_optional(&pool)
        .await?
        .ok_or(AppError::NotFound)?;

    let old_status = current.status.clone();

    let mut tx = pool.begin().await?;

    sqlx::query(
        "UPDATE issues SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(&body.status)
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    let log_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO activity_logs (id, issue_id, field, old_value, new_value) VALUES (?, ?, 'status', ?, ?)",
    )
    .bind(&log_id)
    .bind(&id)
    .bind(&old_status)
    .bind(&body.status)
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, IssueRow>(GET_ISSUE_SQL)
        .bind(&id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(Issue::from(row)))
}

pub async fn update_issue_sprint(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(body): Json<UpdateIssueSprint>,
) -> Result<Json<Issue>> {
    let result =
        sqlx::query("UPDATE issues SET sprint_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(&body.sprint_id)
            .bind(&id)
            .execute(&pool)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as::<_, IssueRow>(GET_ISSUE_SQL)
        .bind(&id)
        .fetch_one(&pool)
        .await?;

    Ok(Json(Issue::from(row)))
}

pub async fn list_children(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Issue>>> {
    let rows = sqlx::query_as::<_, IssueRow>("SELECT id, project_id, sprint_id, parent_id, number, title, description, type, status, priority, points, assignee, labels, position, created_at, updated_at FROM issues WHERE parent_id = ? ORDER BY position ASC, created_at ASC")
        .bind(&id)
        .fetch_all(&pool)
        .await?;
    Ok(Json(rows.into_iter().map(Issue::from).collect()))
}

#[derive(serde::Deserialize)]
pub struct ReorderBody {
    pub ids: Vec<String>,
}

/// Position gap between issues; large enough to allow future insertion without reordering
const POSITION_GAP: i64 = 1000;

pub async fn reorder_issues(
    State(pool): State<SqlitePool>,
    Path(_project_id): Path<String>,
    Json(body): Json<ReorderBody>,
) -> Result<Json<serde_json::Value>> {
    let mut tx = pool.begin().await?;
    for (i, id) in body.ids.iter().enumerate() {
        sqlx::query("UPDATE issues SET position=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind((i as i64) * POSITION_GAP)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// Comments

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Comment {
    pub id: String,
    pub issue_id: String,
    pub author: String,
    pub body: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateComment {
    pub author: String,
    pub body: String,
}

pub async fn list_comments(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Comment>>> {
    let comments = sqlx::query_as::<_, Comment>(
        "SELECT id, issue_id, author, body, created_at, updated_at FROM comments WHERE issue_id = ? ORDER BY created_at ASC",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;
    Ok(Json(comments))
}

pub async fn create_comment(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(body): Json<CreateComment>,
) -> Result<Json<Comment>> {
    if body.author.trim().is_empty() {
        return Err(AppError::BadRequest("author is required".to_string()));
    }
    if body.body.trim().is_empty() {
        return Err(AppError::BadRequest("body is required".to_string()));
    }
    if body.body.len() > 10000 {
        return Err(AppError::BadRequest("body must be 10000 characters or fewer".to_string()));
    }

    let comment_id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO comments (id, issue_id, author, body) VALUES (?, ?, ?, ?)")
        .bind(&comment_id)
        .bind(&id)
        .bind(&body.author)
        .bind(&body.body)
        .execute(&pool)
        .await?;

    let comment = sqlx::query_as::<_, Comment>(
        "SELECT id, issue_id, author, body, created_at, updated_at FROM comments WHERE id = ?",
    )
    .bind(&comment_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(comment))
}

// Activity logs

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ActivityLog {
    pub id: String,
    pub issue_id: String,
    pub field: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: NaiveDateTime,
}

pub async fn list_activity(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ActivityLog>>> {
    let logs = sqlx::query_as::<_, ActivityLog>(
        "SELECT id, issue_id, field, old_value, new_value, created_at FROM activity_logs WHERE issue_id = ? ORDER BY created_at ASC",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await?;
    Ok(Json(logs))
}
