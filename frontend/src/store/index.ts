import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Sprint } from '../types'

interface AppState {
  activeProjectId: string | null
  activeSprint: Sprint | null
  boardFilters: {
    assignee?: string
    priority?: string
    type?: string
  }
  setActiveProject: (id: string | null) => void
  setActiveSprint: (sprint: Sprint | null) => void
  setBoardFilter: (key: string, value: string | undefined) => void
  clearBoardFilters: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      activeSprint: null,
      boardFilters: {},
      setActiveProject: (id) => set({ activeProjectId: id, activeSprint: null }),
      setActiveSprint: (sprint) => set({ activeSprint: sprint }),
      setBoardFilter: (key, value) =>
        set((s) => ({ boardFilters: { ...s.boardFilters, [key]: value } })),
      clearBoardFilters: () => set({ boardFilters: {} }),
    }),
    { name: 'lira-app-state' }
  )
)
