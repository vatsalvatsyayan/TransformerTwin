// Single FMEA failure mode card (collapsible)

import { memo, useState } from 'react'
import { StatusDot } from '../common/StatusDot'
import type { FMEAActiveMode } from '../../types/fmea'

export interface FMEACardProps {
  mode: FMEAActiveMode
}

export const FMEACard = memo(function FMEACard({ mode }: FMEACardProps) {
  const [expanded, setExpanded] = useState(false)

  const scoreColor =
    mode.match_score >= 0.7 ? 'text-red-400' :
    mode.match_score >= 0.4 ? 'text-orange-400' :
    'text-yellow-400'

  return (
    <div className="card mb-2 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#2d3148] transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={`text-xs font-mono font-bold ${scoreColor}`}>
          {(mode.match_score * 100).toFixed(0)}%
        </span>
        <StatusDot
          status={
            mode.confidence_label === 'Probable' ? 'CRITICAL' :
            mode.confidence_label === 'Possible' ? 'WARNING' : 'CAUTION'
          }
          size="sm"
        />
        <span className="flex-1 text-xs text-slate-200 font-medium">{mode.name}</span>
        <span className="text-[10px] text-slate-500">{mode.id}</span>
        <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-[#2d3148] px-3 py-2 space-y-2 text-xs">
          <div className="space-y-1">
            {mode.evidence.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 flex-shrink-0 ${e.matched ? 'text-green-400' : 'text-slate-600'}`}>
                  {e.matched ? '✓' : '○'}
                </span>
                <div>
                  <span className="text-slate-400">{e.condition}</span>
                  {e.matched && <span className="ml-2 text-slate-500">({e.value})</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="text-slate-500">
            <span className="font-medium text-slate-400">Development: </span>
            {mode.development_time}
          </div>
          <div className="space-y-0.5">
            {mode.recommended_actions.map((action, i) => (
              <div key={i} className="text-slate-400">→ {action}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
