import { useQuery } from '@tanstack/react-query'
import { getBurndown } from '../../api/sprints'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Sprint } from '../../types'

interface Props {
  sprint: Sprint
}

export function BurndownChart({ sprint }: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['burndown', sprint.id],
    queryFn: () => getBurndown(sprint.id),
    enabled: !!sprint.start_date && !!sprint.end_date,
  })

  if (!sprint.start_date || !sprint.end_date) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        スプリントの開始日・終了日を設定するとチャートが表示されます
      </div>
    )
  }

  if (isLoading) {
    return <div role="status" aria-label="読み込み中" className="flex items-center justify-center h-48 text-gray-400 text-sm">読み込み中...</div>
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={d => d.slice(5)} // MM-DD
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          labelFormatter={l => `日付: ${l}`}
          formatter={(v, name) => [
            `${Math.round(Number(v))}pt`,
            name === 'ideal' ? 'Ideal' : 'Actual',
          ]}
        />
        <Legend formatter={v => v === 'ideal' ? 'Ideal' : 'Actual'} />
        {data.some(d => d.date === today) && (
          <ReferenceLine x={today} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: '今日', fontSize: 10 }} />
        )}
        <Line
          type="monotone"
          dataKey="ideal"
          stroke="#94a3b8"
          strokeDasharray="5 5"
          dot={false}
          strokeWidth={1.5}
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#3b82f6"
          dot={{ r: 3 }}
          strokeWidth={2}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
