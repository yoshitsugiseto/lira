CREATE TABLE activity_logs (
    id         TEXT PRIMARY KEY,
    issue_id   TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    field      TEXT NOT NULL,
    old_value  TEXT,
    new_value  TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
