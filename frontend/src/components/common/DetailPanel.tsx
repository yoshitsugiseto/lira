import { type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

export function DetailPanel({ title, onClose, children }: Props) {
  return (
    <div className="detail-panel w-1/3 shrink-0 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <h2 className="text-base font-semibold text-gray-900 truncate pr-4">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {children}
      </div>
    </div>
  )
}
