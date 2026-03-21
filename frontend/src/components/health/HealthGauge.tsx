// Circular health gauge (0–100) — SVG-based skeleton

import { memo } from 'react'
import { useStore } from '../../store'
import { STATUS_COLORS } from '../../lib/constants'

export interface HealthGaugeProps {
  size?: number
  mini?: boolean
}

export const HealthGauge = memo(function HealthGauge({ size = 80, mini = false }: HealthGaugeProps) {
  const score = useStore((s) => s.overallScore)
  const status = useStore((s) => s.status)

  const radius = size / 2 - 6
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - score / 100)

  const color =
    status === 'GOOD' ? STATUS_COLORS.NORMAL :
    status === 'FAIR' ? STATUS_COLORS.CAUTION :
    status === 'POOR' ? STATUS_COLORS.WARNING :
    STATUS_COLORS.CRITICAL

  if (mini) {
    return (
      <span
        className="inline-block w-6 h-6 rounded-full border-2 flex-shrink-0"
        style={{ borderColor: color }}
        title={`Health: ${score.toFixed(1)}`}
      />
    )
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#2d3148" strokeWidth={5} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={5} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold font-mono" style={{ color }}>
        {score.toFixed(0)}
      </span>
    </div>
  )
})
