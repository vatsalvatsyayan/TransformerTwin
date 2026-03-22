// Horizontal stacked bar breakdown per health component — clickable rows drive 3D highlight

import { memo } from 'react'
import { useStore } from '../../store'
import { STATUS_COLORS } from '../../lib/constants'
import type { HealthComponentKey } from '../../types/health'

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
  const selectedHealthComponent = useStore((s) => s.selectedHealthComponent)
  const setSelectedHealthComponent = useStore((s) => s.setSelectedHealthComponent)

  const handleClick = (key: HealthComponentKey) => {
    // Toggle: click again to deselect
    setSelectedHealthComponent(selectedHealthComponent === key ? null : key)
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {Object.entries(components).map(([key, comp]) => {
        if (!comp) return null
        const color = STATUS_COLORS[comp.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.NORMAL
        const isSelected = selectedHealthComponent === key
        return (
          <button
            key={key}
            onClick={() => handleClick(key as HealthComponentKey)}
            className={`flex items-center gap-2 w-full text-left rounded px-1 py-0.5 transition-colors ${
              isSelected
                ? 'bg-sky-900/40 ring-1 ring-sky-500/60'
                : 'hover:bg-[#1e2238]'
            }`}
            title={`Click to highlight ${COMPONENT_LABELS[key] ?? key} in 3D view`}
          >
            <span className={`w-20 truncate ${isSelected ? 'text-sky-300' : 'text-slate-400'}`}>
              {COMPONENT_LABELS[key] ?? key}
            </span>
            <div className="flex-1 h-2 bg-[#252840] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, comp.contribution)}%`,
                  backgroundColor: isSelected ? '#38bdf8' : color,
                }}
              />
            </div>
            <span className="w-8 text-right font-mono" style={{ color: isSelected ? '#38bdf8' : color }}>
              {comp.status.slice(0, 1)}
            </span>
          </button>
        )
      })}
      {selectedHealthComponent && (
        <p className="text-[9px] text-sky-400/70 text-center mt-0.5">
          Click again to deselect 3D highlight
        </p>
      )}
    </div>
  )
})
