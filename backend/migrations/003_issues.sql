CREATE TABLE issues (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id),
    sprint_id    TEXT REFERENCES sprints(id),
    number       INTEGER NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    type         TEXT NOT NULL DEFAULT 'task',
    status       TEXT NOT NULL DEFAULT 'todo',
    priority     TEXT NOT NULL DEFAULT 'medium',
    points       INTEGER,
    assignee     TEXT,
    labels       TEXT,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, number)
);
