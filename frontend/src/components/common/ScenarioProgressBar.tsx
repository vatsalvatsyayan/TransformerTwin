// Color-coded scenario progress strip — shown only during active fault simulations

import { memo } from 'react'
import { useStore } from '../../store'

// Color tier thresholds by progress % (early → mid → late stage)
function getTierClasses(pct: number): { text: string; bar: string; border: string; bg: string } {
  if (pct >= 67) {
    return {
      text: 'text-red-400',
      bar: 'bg-red-500',
      border: 'border-red-900',
      bg: 'bg-red-950/40',
    }
  }
  if (pct >= 34) {
    return {
      text: 'text-orange-400',
      bar: 'bg-orange-500',
      border: 'border-orange-900',
      bg: 'bg-orange-950/40',
    }
  }
  return {
    text: 'text-yellow-400',
    bar: 'bg-yellow-500',
    border: 'border-yellow-900',
    bg: 'bg-yellow-950/30',
  }
}

export const ScenarioProgressBar = memo(function ScenarioProgressBar() {
  const activeScenario = useStore((s) => s.activeScenario)
  const scenarioName = useStore((s) => s.scenarioName)
  const stage = useStore((s) => s.stage)
  const progressPercent = useStore((s) => s.progressPercent)

  if (activeScenario === 'normal') return null

  const tier = getTierClasses(progressPercent)

  return (
    <div className={`px-3 py-2.5 border-b ${tier.border} ${tier.bg} flex-shrink-0`}>
      {/* Badge row */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[9px] font-bold uppercase tracking-widest ${tier.text}`}>
          ⚡ Fault Simulation Active
        </span>
        <span className="text-[10px] text-slate-400 tabular-nums">
          {progressPercent.toFixed(0)}%
        </span>
      </div>

      {/* Scenario name */}
      <div className="text-xs font-semibold text-slate-100 truncate">{scenarioName}</div>

      {/* Stage description */}
      <div className="text-[10px] text-slate-400 mt-0.5 truncate">{stage}</div>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full ${tier.bar} rounded-full transition-all duration-1000`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
})
