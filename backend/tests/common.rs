#![allow(dead_code)]

use axum::body::Body;
use axum::http::{HeaderMap, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use tower::ServiceExt;

pub async fn setup_pool() -> SqlitePool {
    let opts = SqliteConnectOptions::from_str("sqlite::memory:")
        .unwrap()
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    pool
}

pub async fn setup_app() -> Router {
    lira::create_app(setup_pool().await)
}

pub async fn send(app: &Router, req: Request<Body>) -> (StatusCode, serde_json::Value) {
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    (status, json)
}

pub async fn send_with_headers(
    app: &Router,
    req: Request<Body>,
) -> (StatusCode, HeaderMap, serde_json::Value) {
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let headers = resp.headers().clone();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    (status, headers, json)
}

pub fn get(uri: &str) -> Request<Body> {
    Request::builder()
        .method("GET")
        .uri(uri)
        .body(Body::empty())
        .unwrap()
}

pub fn post(uri: &str, body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap()
}

pub fn put(uri: &str, body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method("PUT")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap()
}

pub fn patch(uri: &str, body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method("PATCH")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap()
}

pub fn delete(uri: &str) -> Request<Body> {
    Request::builder()
        .method("DELETE")
        .uri(uri)
        .body(Body::empty())
        .unwrap()
}

// --- domain helpers ---

pub async fn create_project(app: &Router, name: &str, key: &str) -> String {
    let (status, json) = send(
        app,
        post("/api/projects", serde_json::json!({ "name": name, "key": key })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "create_project failed: {json}");
    json["id"].as_str().unwrap().to_string()
}

pub async fn create_issue(app: &Router, project_id: &str, title: &str) -> String {
    let (status, json) = send(
        app,
        post(
            &format!("/api/projects/{project_id}/issues"),
            serde_json::json!({ "title": title }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "create_issue failed: {json}");
    json["id"].as_str().unwrap().to_string()
}

pub async fn create_sprint(app: &Router, project_id: &str, name: &str) -> String {
    let (status, json) = send(
        app,
        post(
            &format!("/api/projects/{project_id}/sprints"),
            serde_json::json!({ "name": name }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "create_sprint failed: {json}");
    json["id"].as_str().unwrap().to_string()
}
