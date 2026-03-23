import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createIssue, updateIssue, getIssues } from '../../api/issues'
import type { Issue, IssueType, IssuePriority, UpdateIssue } from '../../types'
import { useToast } from '../common/Toast'
import { extractErrorMessage } from '../../api/client'

interface Props {
  projectId: string
  sprintId?: string
  parentId?: string
  parentPriority?: IssuePriority
  issue?: Issue
  onClose: () => void
}

export function IssueForm({ projectId, sprintId, parentId, parentPriority, issue, onClose }: Props) {
  const qc = useQueryClient()
  const showToast = useToast()
  const [form, setForm] = useState({
    title: issue?.title ?? '',
    description: issue?.description ?? '',
    type: (issue?.type ?? 'task') as IssueType,
    priority: (issue?.priority ?? parentPriority ?? 'medium') as IssuePriority,
    points: issue?.points?.toString() ?? '',
    assignee: issue?.assignee ?? '',
    parent_id: issue?.parent_id ?? parentId ?? '',
  })

  // ストーリー一覧（親候補）
  const { data: allIssues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => getIssues(projectId),
  })
  const stories = allIssues.filter(i => i.type === 'story' && i.id !== issue?.id)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['issues', projectId] })
    onClose()
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createIssue(projectId, {
        ...form,
        points: form.points ? parseInt(form.points) : undefined,
        sprint_id: sprintId,
        parent_id: form.parent_id || undefined,
      }),
    onSuccess: invalidate,
    onError: (err) => showToast(extractErrorMessage(err, 'イシューの作成に失敗しました'), 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      const data: UpdateIssue = {
        ...form,
        points: form.points ? parseInt(form.points) : undefined,
        parent_id: form.parent_id || null,
      }
      return updateIssue(issue!.id, data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] })
      qc.invalidateQueries({ queryKey: ['issue', issue!.id] })
      onClose()
    },
    onError: (err) => showToast(extractErrorMessage(err, 'イシューの更新に失敗しました'), 'error'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (issue) updateMutation.mutate()
    else createMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          required
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Issue title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={form.type}
            onChange={e => {
              const newType = e.target.value as IssueType
              setForm(f => ({
                ...f,
                type: newType,
                // Storiesは親を持てないので parent_id をクリア
                parent_id: newType === 'story' ? '' : f.parent_id,
              }))
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="task">Task</option>
            <option value="story">Story</option>
            <option value="bug">Bug</option>
            <option value="spike">Spike</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value as IssuePriority }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
          <input
            type="number"
            min="0"
            max="999"
            value={form.points}
            onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="0"
            aria-label="ストーリーポイント (0〜999)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
          <input
            value={form.assignee}
            onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Name"
          />
        </div>
      </div>

      {/* 親ストーリー（Story タイプ以外のとき表示） */}
      {form.type !== 'story' && stories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parent Story</label>
          <select
            value={form.parent_id}
            onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">なし</option>
            {stories.map(s => (
              <option key={s.id} value={s.id}>#{s.number} {s.title}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : issue ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
