import { Droppable } from '@hello-pangea/dnd'
import type { Issue, IssueStatus } from '../../types'
import { IssueCard } from './IssueCard'

const statusMeta: Record<IssueStatus, { label: string; color: string }> = {
  todo: { label: 'Todo', color: 'border-gray-300' },
  in_progress: { label: 'In Progress', color: 'border-blue-400' },
  in_review: { label: 'In Review', color: 'border-purple-400' },
  done: { label: 'Done', color: 'border-emerald-400' },
}

interface Props {
  status: IssueStatus
  issues: Issue[]
  projectId: string
}

export function Column({ status, issues, projectId }: Props) {
  const meta = statusMeta[status]

  return (
    <div className="flex flex-col min-w-64 flex-1">
      <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${meta.color}`}>
        <span className="font-semibold text-gray-700 text-sm">{meta.label}</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {issues.length}
        </span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 flex-1 min-h-32 rounded-lg p-1 transition-colors duration-150 ${
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
          >
            {issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                projectId={projectId}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
