// Color-status legend overlay

import { memo } from 'react'
import { STATUS_COLORS } from '../../lib/constants'

const LEGEND_ITEMS = [
  { label: 'Normal', key: 'NORMAL' },
  { label: 'Caution', key: 'CAUTION' },
  { label: 'Warning', key: 'WARNING' },
  { label: 'Critical', key: 'CRITICAL' },
] as const

export const StatusLegend = memo(function StatusLegend() {
  return (
    <div className="absolute bottom-3 left-3 flex flex-col gap-1 text-xs bg-white/70 backdrop-blur-sm rounded px-2 py-1.5 shadow">
      {LEGEND_ITEMS.map(({ label, key }) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[key] }}
          />
          <span className="text-slate-700 font-medium">{label}</span>
        </div>
      ))}
    </div>
  )
})
