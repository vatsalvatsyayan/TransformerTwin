// App header bar (56px height)

import { memo } from 'react'
import { ConnectionIndicator } from '../common/ConnectionIndicator'
import { SpeedControl } from '../common/SpeedControl'
import { ScenarioSelector } from '../common/ScenarioSelector'
import { AlertBadge } from '../common/AlertBadge'
import { useStore } from '../../store'
import { formatHealthScore } from '../../lib/formatters'

export const Header = memo(function Header() {
  const score = useStore((s) => s.overallScore)
  const status = useStore((s) => s.status)

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-[#1a1d27] border-b border-[#2d3148] flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-white tracking-tight">TransformerTwin</span>
        <span className="text-xs text-slate-500">TRF-001 | Main Power Transformer Unit 1</span>
      </div>

      <div className="flex items-center gap-4">
        <ScenarioSelector />
        <SpeedControl />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Health:</span>
          <span
            className={`text-sm font-bold font-mono ${
              status === 'GOOD' ? 'text-green-400'
              : status === 'FAIR' ? 'text-yellow-400'
              : status === 'POOR' ? 'text-orange-400'
              : 'text-red-400'
            }`}
          >
            {formatHealthScore(score)}
          </span>
        </div>
        <AlertBadge />
        <ConnectionIndicator />
      </div>
    </header>
  )
})
