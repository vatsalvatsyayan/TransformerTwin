// Horizontal stacked bar breakdown per health component — skeleton

import { memo } from 'react'
import { useStore } from '../../store'
import { STATUS_COLORS } from '../../lib/constants'

const COMPONENT_LABELS: Record<string, string> = {
  dga: 'DGA',
  winding_temp: 'Winding',
  oil_temp: 'Oil Temp',
  cooling: 'Cooling',
  oil_quality: 'Oil Quality',
  bushing: 'Bushing',
}

export const HealthBreakdown = memo(function HealthBreakdown() {
  const components = useStore((s) => s.components)

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {Object.entries(components).map(([key, comp]) => {
        if (!comp) return null
        const color = STATUS_COLORS[comp.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.NORMAL
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-20 text-slate-400 truncate">{COMPONENT_LABELS[key] ?? key}</span>
            <div className="flex-1 h-2 bg-[#252840] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, comp.contribution)}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-8 text-right font-mono" style={{ color }}>
              {comp.status.slice(0, 1)}
            </span>
          </div>
        )
      })}
    </div>
  )
})
