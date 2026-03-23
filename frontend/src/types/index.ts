export interface Project {
  id: string
  name: string
  key: string
  description: string | null
  created_at: string
  updated_at: string
}

export type SprintStatus = 'planning' | 'active' | 'completed'

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string | null
  status: SprintStatus
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low'
export type IssueType = 'story' | 'task' | 'bug' | 'spike'

export interface Issue {
  id: string
  project_id: string
  sprint_id: string | null
  parent_id: string | null
  number: number
  title: string
  description: string | null
  type: IssueType
  status: IssueStatus
  priority: IssuePriority
  points: number | null
  assignee: string | null
  labels: string[]
  position: number
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  issue_id: string
  author: string
  body: string
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  issue_id: string
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface BurndownPoint {
  date: string
  ideal: number
  actual: number
}

// Form types
export interface CreateProject {
  name: string
  key: string
  description?: string
}

export interface CreateSprint {
  name: string
  goal?: string
  start_date?: string
  end_date?: string
}

export interface CreateIssue {
  title: string
  description?: string
  type?: IssueType
  priority?: IssuePriority
  points?: number
  assignee?: string
  labels?: string[]
  sprint_id?: string
  parent_id?: string
}

export interface UpdateIssue {
  title?: string
  description?: string
  type?: IssueType
  status?: IssueStatus
  priority?: IssuePriority
  points?: number
  assignee?: string
  labels?: string[]
  sprint_id?: string | null
  parent_id?: string | null
}
