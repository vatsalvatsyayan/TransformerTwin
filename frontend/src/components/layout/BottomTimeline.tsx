// 48px playback timeline bar

import { memo } from 'react'
import { useStore } from '../../store'
import { formatSimTime } from '../../lib/formatters'

export const BottomTimeline = memo(function BottomTimeline() {
  const simTime = useStore((s) => s.simTime)
  const wallClock = useStore((s) => s.wallClockTime)
  const scenario = useStore((s) => s.scenarioName)
  const stage = useStore((s) => s.stage)
  const progress = useStore((s) => s.progressPercent)
  const activeScenario = useStore((s) => s.activeScenario)

  return (
    <div className="h-12 flex items-center px-4 bg-[#1a1d27] border-t border-[#2d3148] flex-shrink-0">
      <div className="flex items-center gap-4 text-xs text-slate-400 flex-1">
        {/* Sim time */}
        <span className="font-mono text-slate-300">
          T+{formatSimTime(simTime)}
        </span>

        {/* Wall clock */}
        {wallClock && (
          <span className="text-slate-500">
            {new Date(wallClock).toLocaleTimeString()}
          </span>
        )}

        {/* Scenario progress */}
        {activeScenario !== 'normal' && (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-orange-400 font-medium">{scenario}</span>
            <div className="flex-1 max-w-48 h-1.5 bg-[#252840] rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-slate-500">{progress.toFixed(0)}%</span>
            <span className="text-slate-600 truncate max-w-64">{stage}</span>
          </div>
        )}
      </div>
    </div>
  )
})
