-- Performance indexes for frequently filtered/joined columns
CREATE INDEX IF NOT EXISTS idx_issues_project_id      ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_sprint_id       ON issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_issues_status          ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_parent_id       ON issues(parent_id);
CREATE INDEX IF NOT EXISTS idx_sprints_project_id     ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue_id      ON comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_issue_id ON activity_logs(issue_id);
