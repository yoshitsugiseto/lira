CREATE TABLE sprints (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    name        TEXT NOT NULL,
    goal        TEXT,
    status      TEXT NOT NULL DEFAULT 'planning',
    start_date  DATE,
    end_date    DATE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
