mod issues;
mod projects;
mod sprints;

use axum::{
    routing::{get, patch, post, put},
    Router,
};
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        // Projects
        .route("/api/projects", get(projects::list_projects).post(projects::create_project))
        .route(
            "/api/projects/{id}",
            get(projects::get_project)
                .put(projects::update_project)
                .delete(projects::delete_project),
        )
        // Sprints
        .route(
            "/api/projects/{id}/sprints",
            get(sprints::list_sprints).post(sprints::create_sprint),
        )
        .route(
            "/api/sprints/{id}",
            get(sprints::get_sprint)
                .put(sprints::update_sprint)
                .delete(sprints::delete_sprint),
        )
        .route("/api/sprints/{id}/start", post(sprints::start_sprint))
        .route("/api/sprints/{id}/complete", post(sprints::complete_sprint))
        .route("/api/sprints/{id}/burndown", get(sprints::get_burndown))
        // Issues
        .route(
            "/api/projects/{id}/issues",
            get(issues::list_issues).post(issues::create_issue),
        )
        .route(
            "/api/issues/{id}",
            get(issues::get_issue)
                .put(issues::update_issue)
                .delete(issues::delete_issue),
        )
        .route("/api/issues/{id}/status", patch(issues::update_issue_status))
        .route("/api/issues/{id}/sprint", patch(issues::update_issue_sprint))
        .route("/api/issues/{id}/children", get(issues::list_children))
        .route("/api/projects/{id}/issues/reorder", put(issues::reorder_issues))
        .route(
            "/api/issues/{id}/comments",
            get(issues::list_comments).post(issues::create_comment),
        )
        .route("/api/issues/{id}/activity", get(issues::list_activity))
        .with_state(pool)
}
