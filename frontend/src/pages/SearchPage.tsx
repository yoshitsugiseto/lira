import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getIssuesPaged } from '../api/issues'
import { useAppStore } from '../store'
import { TypeIcon, PriorityBadge, StatusBadge } from '../components/common/Badge'
import { Modal } from '../components/common/Modal'
import { IssueDetail } from '../components/Issue/IssueDetail'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 20

interface Props {
  query: string
}

export function SearchPage({ query }: Props) {
  const { activeProjectId } = useAppStore()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  // queryが変わったらページを0にリセット
  useEffect(() => { setPage(0) }, [query])

  const effectivePage = query.length >= 2 ? page : 0

  const { data, isLoading, isError } = useQuery({
    queryKey: ['issues', activeProjectId, 'search', query, effectivePage],
    queryFn: () =>
      getIssuesPaged(activeProjectId!, {
        q: query,
        limit: PAGE_SIZE,
        offset: effectivePage * PAGE_SIZE,
      }),
    enabled: !!activeProjectId && query.length >= 2,
    placeholderData: prev => prev,
  })

  const issues = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const start = effectivePage * PAGE_SIZE + 1
  const end = Math.min(effectivePage * PAGE_SIZE + issues.length, total)

  if (!activeProjectId) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">← プロジェクトを選択してください</div>
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Search size={18} className="text-gray-400" aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900">
            {query.length < 2 ? '検索' : `"${query}" の検索結果`}
          </h1>
          {query.length >= 2 && !isLoading && total > 0 && (
            <span className="text-sm text-gray-400 ml-2">{total}件</span>
          )}
        </div>

        {/* Pagination info */}
        {query.length >= 2 && !isLoading && total > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            {start}〜{end}件目を表示
          </p>
        )}

        {query.length < 2 && (
          <p className="text-gray-400 text-sm">2文字以上入力してください</p>
        )}

        {isLoading && (
          <p role="status" aria-label="検索中" className="text-gray-400">検索中...</p>
        )}

        {isError && (
          <p className="text-red-400 text-sm">検索に失敗しました</p>
        )}

        {!isLoading && !isError && query.length >= 2 && issues.length === 0 && (
          <p className="text-gray-400 text-sm">該当するイシューが見つかりません</p>
        )}

        {/* Results */}
        <div className="space-y-1">
          {issues.map(issue => (
            <div
              key={issue.id}
              onClick={() => setDetailId(issue.id)}
              className="flex items-center gap-3 py-2.5 px-4 bg-white border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-colors"
            >
              <TypeIcon type={issue.type} />
              <span className="text-xs text-gray-400 font-mono w-14 shrink-0">#{issue.number}</span>
              <span className="flex-1 text-sm text-gray-900 font-medium truncate">{issue.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={issue.status} />
                <PriorityBadge priority={issue.priority} />
                {issue.points != null && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                    {issue.points}pt
                  </span>
                )}
              </div>
            </div>
          ))}
          {issues.length > 0 && Array.from({ length: PAGE_SIZE - issues.length }).map((_, i) => (
            <div key={`ph-${i}`} className="flex items-center py-2.5 px-4 border border-transparent" aria-hidden="true">
              <span className="text-sm invisible">_</span>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="ページネーション"
            className="mt-4 flex items-center justify-between"
          >
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={effectivePage === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="前のページ"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              前へ
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => {
                if (
                  i === 0 ||
                  i === totalPages - 1 ||
                  Math.abs(i - effectivePage) <= 1
                ) {
                  return (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      aria-current={i === effectivePage ? 'page' : undefined}
                      className={`w-8 h-8 text-sm rounded-lg ${
                        i === effectivePage
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  )
                }
                if (i === 1 && effectivePage > 3) {
                  return <span key="ellipsis-start" className="text-gray-400 px-1">…</span>
                }
                if (i === totalPages - 2 && effectivePage < totalPages - 4) {
                  return <span key="ellipsis-end" className="text-gray-400 px-1">…</span>
                }
                return null
              })}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={effectivePage >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="次のページ"
            >
              次へ
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>

      {detailId && (() => {
        const issue = issues.find(i => i.id === detailId)
        return (
          <Modal
            title={issue ? `#${issue.number} ${issue.title}` : 'Issue詳細'}
            onClose={() => setDetailId(null)}
            size="lg"
          >
            <IssueDetail issueId={detailId} projectId={activeProjectId} />
          </Modal>
        )
      })()}
    </div>
  )
}
