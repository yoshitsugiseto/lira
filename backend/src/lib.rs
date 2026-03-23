pub mod db;
pub mod error;
pub mod models;
pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub fn create_app(pool: SqlitePool) -> Router {
    routes::router(pool)
}
