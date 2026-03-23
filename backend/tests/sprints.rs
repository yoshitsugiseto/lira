mod common;

use axum::http::StatusCode;
use serde_json::json;

#[tokio::test]
async fn create_sprint_success() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;

    let (status, json) = common::send(
        &app,
        common::post(
            &format!("/api/projects/{pid}/sprints"),
            json!({ "name": "Sprint 1", "goal": "Ship it",
                     "start_date": "2026-01-01", "end_date": "2026-01-14" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["name"], "Sprint 1");
    assert_eq!(json["status"], "planning");
    assert_eq!(json["goal"], "Ship it");
}

#[tokio::test]
async fn create_sprint_empty_name_returns_400() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;

    let (status, _) = common::send(
        &app,
        common::post(
            &format!("/api/projects/{pid}/sprints"),
            json!({ "name": "" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn create_sprint_start_after_end_returns_400() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;

    let (status, _) = common::send(
        &app,
        common::post(
            &format!("/api/projects/{pid}/sprints"),
            json!({ "name": "Sprint 1", "start_date": "2026-01-14", "end_date": "2026-01-01" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn list_sprints() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;
    common::create_sprint(&app, &pid, "Sprint 1").await;
    common::create_sprint(&app, &pid, "Sprint 2").await;

    let (status, json) =
        common::send(&app, common::get(&format!("/api/projects/{pid}/sprints"))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn start_sprint_changes_status_to_active() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;
    let sid = common::create_sprint(&app, &pid, "Sprint 1").await;

    let (status, json) = common::send(
        &app,
        common::post(&format!("/api/sprints/{sid}/start"), json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["status"], "active");
}

#[tokio::test]
async fn start_already_active_sprint_returns_400() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;
    let sid = common::create_sprint(&app, &pid, "Sprint 1").await;

    common::send(
        &app,
        common::post(&format!("/api/sprints/{sid}/start"), json!({})),
    )
    .await;

    let (status, _) = common::send(
        &app,
        common::post(&format!("/api/sprints/{sid}/start"), json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn complete_sprint_moves_incomplete_issues_to_backlog() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;
    let sid = common::create_sprint(&app, &pid, "Sprint 1").await;

    // Add incomplete issue to sprint
    let (_, issue) = common::send(
        &app,
        common::post(
            &format!("/api/projects/{pid}/issues"),
            json!({ "title": "Incomplete", "sprint_id": sid }),
        ),
    )
    .await;
    let iid = issue["id"].as_str().unwrap().to_string();

    // Start then complete
    common::send(
        &app,
        common::post(&format!("/api/sprints/{sid}/start"), json!({})),
    )
    .await;
    let (status, json) = common::send(
        &app,
        common::post(&format!("/api/sprints/{sid}/complete"), json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["status"], "completed");

    // Issue moved to backlog
    let (_, issue) = common::send(&app, common::get(&format!("/api/issues/{iid}"))).await;
    assert!(issue["sprint_id"].is_null());
}

#[tokio::test]
async fn complete_sprint_done_issues_stay() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;
    let sid = common::create_sprint(&app, &pid, "Sprint 1").await;

    let (_, issue) = common::send(
        &app,
        common::post(
            &format!("/api/projects/{pid}/issues"),
            json!({ "title": "Done issue", "sprint_id": sid }),
        ),
    )
    .await;
    let iid = issue["id"].as_str().unwrap().to_string();

    // Mark as done
    common::send(
        &app,
        common::patch(
            &format!("/api/issues/{iid}/status"),
            json!({ "status": "done" }),
        ),
    )
    .await;

    common::send(
        &app,
        common::post(&format!("/api/sprints/{sid}/start"), json!({})),
    )
    .await;
    common::send(
        &app,
        common::post(&format!("/api/sprints/{sid}/complete"), json!({})),
    )
    .await;

    // Done issue should still be in the sprint
    let (_, issue) = common::send(&app, common::get(&format!("/api/issues/{iid}"))).await;
    assert_eq!(issue["sprint_id"], sid);
}

#[tokio::test]
async fn delete_sprint_unassigns_issues() {
    let app = common::setup_app().await;
    let pid = common::create_project(&app, "P", "SP").await;
    let sid = common::create_sprint(&app, &pid, "Sprint 1").await;

    let (_, issue) = common::send(
        &app,
        common::post(
            &format!("/api/projects/{pid}/issues"),
            json!({ "title": "Issue", "sprint_id": sid }),
        ),
    )
    .await;
    let iid = issue["id"].as_str().unwrap().to_string();

    let (status, _) = common::send(&app, common::delete(&format!("/api/sprints/{sid}"))).await;
    assert_eq!(status, StatusCode::OK);

    // Sprint gone
    let (status, _) = common::send(&app, common::get(&format!("/api/sprints/{sid}"))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Issue moved to backlog
    let (_, issue) = common::send(&app, common::get(&format!("/api/issues/{iid}"))).await;
    assert!(issue["sprint_id"].is_null());
}
