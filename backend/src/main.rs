use axum::http::{HeaderValue, Method, header};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./lira.db".to_string());

    let pool = lira::db::create_pool(&database_url).await?;
    tracing::info!("Database connected: {database_url}");

    let cors_origin = std::env::var("CORS_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    let cors = CorsLayer::new()
        .allow_origin(cors_origin.parse::<HeaderValue>()?)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT])
        .expose_headers(["x-total-count".parse::<axum::http::HeaderName>()?]);

    let app = lira::create_app(pool)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = "0.0.0.0:8080";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Listening on http://{addr}");

    axum::serve(listener, app).await?;
    Ok(())
}
