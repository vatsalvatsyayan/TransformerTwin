// Hover tooltip — follows cursor, shows part name and health status

import { memo } from 'react'
import { STATUS_COLORS } from '../../lib/constants'

export interface ComponentTooltipProps {
  label: string
  healthStatus?: string
  visible: boolean
  x: number
  y: number
}

export const ComponentTooltip = memo(function ComponentTooltip({
  label,
  healthStatus,
  visible,
  x,
  y,
}: ComponentTooltipProps) {
  if (!visible) return null

  const statusColor = healthStatus
    ? (STATUS_COLORS[healthStatus as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.NORMAL)
    : undefined

  return (
    <div
      className="absolute pointer-events-none z-20 bg-[#1a1f2e]/95 border border-[#3d4168] rounded shadow-xl px-3 py-2 min-w-[120px]"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="text-white text-xs font-semibold leading-tight">{label}</div>
      {healthStatus && statusColor && (
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-xs" style={{ color: statusColor }}>
            {healthStatus}
          </span>
        </div>
      )}
    </div>
  )
})
