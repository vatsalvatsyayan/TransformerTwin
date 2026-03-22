// Compact single-line scenario progress strip — shown only during active fault simulations.
// Redesigned from a tall multi-line block (~90px) to a single-row strip (~32px) so it
// doesn't displace tab content on smaller screens.

import { memo } from 'react'
import { useStore } from '../../store'

// Color tier thresholds by progress % (early → mid → late stage)
function getTierClasses(pct: number): { text: string; bar: string; border: string; bg: string } {
  if (pct >= 67) {
    return {
      text: 'text-red-400',
      bar: 'bg-red-500',
      border: 'border-red-900/60',
      bg: 'bg-red-950/40',
    }
  }
  if (pct >= 34) {
    return {
      text: 'text-orange-400',
      bar: 'bg-orange-500',
      border: 'border-orange-900/60',
      bg: 'bg-orange-950/40',
    }
  }
  return {
    text: 'text-yellow-400',
    bar: 'bg-yellow-500',
    border: 'border-yellow-900/60',
    bg: 'bg-yellow-950/30',
  }
}

export const ScenarioProgressBar = memo(function ScenarioProgressBar() {
  const activeScenario  = useStore((s) => s.activeScenario)
  const scenarioName    = useStore((s) => s.scenarioName)
  const stage           = useStore((s) => s.stage)
  const progressPercent = useStore((s) => s.progressPercent)
  const cascadeTriggered = useStore((s) => s.cascadeTriggered)
  const terminalFailure = useStore((s) => s.terminalFailure)

  const isActive = activeScenario !== 'normal'
  if (!isActive && !cascadeTriggered && !terminalFailure) return null

  const tier = getTierClasses(progressPercent)

  return (
    <div className="flex-shrink-0">
      {/* Terminal failure: permanent tripped state banner */}
      {terminalFailure && (
        <div className="flex items-center gap-2 px-3 py-1 bg-black border-b border-red-600/80 animate-pulse">
          <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest">
            ⚡ TRANSFORMER TRIPPED — PROTECTION RELAY OPERATED
          </span>
        </div>
      )}

      {/* Cascade emergency: single compact line */}
      {cascadeTriggered && (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-950/80 border-b border-red-700/60">
          <svg className="w-3 h-3 text-red-400 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-bold text-red-300 uppercase tracking-wide truncate">
            CASCADE FAILURE — Thermal→Arcing Escalation Active
          </span>
        </div>
      )}

      {/* Active scenario: single compact row with inline progress bar */}
      {isActive && (
        <div className={`flex items-center gap-2 px-3 py-1 border-b ${tier.border} ${tier.bg}`}>
          <span className={`text-[9px] font-bold flex-shrink-0 ${tier.text}`}>⚡</span>
          <span className={`text-[10px] font-semibold flex-shrink-0 ${tier.text} truncate max-w-[120px]`}>
            {scenarioName}
          </span>
          <span className="text-[10px] text-slate-500 truncate flex-1 hidden sm:block">{stage}</span>
          {/* Inline mini progress bar */}
          <div className="w-16 h-1.5 bg-slate-700/60 rounded-full overflow-hidden flex-shrink-0">
            <div
              className={`h-full ${tier.bar} rounded-full transition-all duration-1000`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className={`text-[10px] tabular-nums flex-shrink-0 w-7 text-right ${tier.text}`}>
            {progressPercent.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
})
