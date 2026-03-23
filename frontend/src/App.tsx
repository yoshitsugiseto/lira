import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trello, List, Zap, Plus, FolderOpen, LayoutDashboard, Search } from 'lucide-react'
import { useToast } from './components/common/Toast'
import { extractErrorMessage } from './api/client'
import { BoardPage } from './pages/BoardPage'
import { BacklogPage } from './pages/BacklogPage'
import { SprintPage } from './pages/SprintPage'
import { SprintHistoryPage } from './pages/SprintHistoryPage'
import { DashboardPage } from './pages/DashboardPage'
import { SearchPage } from './pages/SearchPage'
import { Modal } from './components/common/Modal'
import { getProjects, createProject } from './api/projects'
import { useAppStore } from './store'

type Page = 'dashboard' | 'board' | 'backlog' | 'sprints' | 'sprint-history'

function NewProjectForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { setActiveProject } = useAppStore()
  const [form, setForm] = useState({ name: '', key: '', description: '' })
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: () => createProject(form),
    onSuccess: (proj) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setActiveProject(proj.id)
      onClose()
    },
    onError: (err) => showToast(extractErrorMessage(err, 'プロジェクトの作成に失敗しました'), 'error'),
  })

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
        <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="My Project" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Key * (例: PROJ)</label>
        <input required value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase() }))}
          maxLength={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase"
          placeholder="PROJ" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
        <button type="submit" disabled={mutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [creatingProject, setCreatingProject] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const { activeProjectId, setActiveProject } = useAppStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
      setSearching(searchInput.length > 0)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  })

  const activeProject = projects.find(p => p.id === activeProjectId)

  const navItems: { id: Page; icon: React.ReactNode; label: string }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { id: 'board', icon: <Trello size={16} />, label: 'Board' },
    { id: 'backlog', icon: <List size={16} />, label: 'Backlog' },
    { id: 'sprints', icon: <Zap size={16} />, label: 'Sprints' },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-blue-600 tracking-tight">Lira</h1>
          <p className="text-xs text-gray-400">Sprint Manager</p>
        </div>

        {/* Project selector */}
        <div className="px-3 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</span>
            <button onClick={() => setCreatingProject(true)} aria-label="プロジェクトを作成" className="text-gray-400 hover:text-blue-600">
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
                  p.id === activeProjectId
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FolderOpen size={14} />
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-gray-400 font-mono ml-auto">{p.key}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">No projects yet</p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setSearchInput('')
                  setSearchQuery('')
                  setSearching(false)
                }
              }}
              aria-label="イシューを検索"
              placeholder="イシューを検索..."
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 py-3 flex-1">
          {activeProject && (
            <p className="text-xs text-gray-400 px-2 mb-2 truncate">{activeProject.name}</p>
          )}
          <div className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setSearching(false); setSearchQuery(''); setSearchInput('') }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  page === item.id && !searching
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {searching
          ? <SearchPage query={searchQuery} />
          : <>
              {page === 'dashboard' && <DashboardPage />}
              {page === 'board' && <BoardPage />}
              {page === 'backlog' && <BacklogPage />}
              {page === 'sprints' && <SprintPage onNavigate={p => setPage(p as Page)} />}
              {page === 'sprint-history' && <SprintHistoryPage onNavigate={p => setPage(p as Page)} />}
            </>
        }
      </main>

      {creatingProject && (
        <Modal title="New Project" onClose={() => setCreatingProject(false)}>
          <NewProjectForm onClose={() => setCreatingProject(false)} />
        </Modal>
      )}
    </div>
  )
}
