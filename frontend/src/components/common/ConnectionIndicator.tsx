// WebSocket connection status indicator

import { memo } from 'react'
import { useConnectionStatus } from '../../store/selectors'

const STATUS_LABELS = {
  connected: 'Live',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
} as const

const STATUS_COLORS = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500 animate-pulse',
  disconnected: 'bg-red-500',
} as const

export const ConnectionIndicator = memo(function ConnectionIndicator() {
  const status = useConnectionStatus()
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
      <span>{STATUS_LABELS[status]}</span>
    </div>
  )
})
