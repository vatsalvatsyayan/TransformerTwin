// 48px playback timeline bar — shows sim time, scenario progress, and historical scrubber.

import { memo, useCallback, useRef, useState } from 'react'
import { useStore } from '../../store'
import { formatSimTime } from '../../lib/formatters'
import { usePlayback } from '../../hooks/usePlayback'
import { api } from '../../lib/api'
import type { SensorReadings } from '../../types/sensors'

export const BottomTimeline = memo(function BottomTimeline() {
  const simTime             = useStore((s) => s.simTime)
  const maxAvailableSimTime = useStore((s) => s.maxAvailableSimTime)
  const wallClock           = useStore((s) => s.wallClockTime)
  const scenario = useStore((s) => s.scenarioName)
  const stage = useStore((s) => s.stage)
  const progress = useStore((s) => s.progressPercent)
  const activeScenario = useStore((s) => s.activeScenario)
  const updateReadings = useStore((s) => s.updateReadings)

  const { isLive, playbackPosition, enterPlayback, exitPlayback } = usePlayback()

  // Local scrubber value — tracks slider position independently for responsiveness
  const [scrubValue, setScrubValue] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Debounced snapshot loader — fires 150ms after the last slider movement */
  const loadSnapshot = useCallback(
    (targetSimTime: number) => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
      loadTimerRef.current = setTimeout(async () => {
        setIsLoading(true)
        try {
          const snap = await api.getSensorsSnapshot(targetSimTime)
          updateReadings(
            'snapshot',
            snap.sensors as Partial<SensorReadings>,
            snap.sim_time,
            snap.timestamp,
          )
          enterPlayback(String(snap.sim_time))
        } catch {
          exitPlayback()
        } finally {
          setIsLoading(false)
        }
      }, 150)
    },
    [enterPlayback, exitPlayback, updateReadings],
  )

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value)
      setScrubValue(val)
      loadSnapshot(val)
    },
    [loadSnapshot],
  )

  const handleGoLive = useCallback(() => {
    exitPlayback()
  }, [exitPlayback])

  const handleEnterPlayback = useCallback(() => {
    setScrubValue(simTime)
    loadSnapshot(simTime)
  }, [simTime, loadSnapshot])

  return (
    <div className="h-12 flex items-center px-4 bg-[#1a1d27] border-t border-[#2d3148] flex-shrink-0 gap-3">
      {/* Live / Playback badge */}
      {isLive ? (
        <button
          onClick={handleEnterPlayback}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 hover:bg-emerald-800/50 transition-colors flex-shrink-0"
          title="Click to enter historical playback mode"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </button>
      ) : (
        <button
          onClick={handleGoLive}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-900/40 text-amber-400 border border-amber-700/40 hover:bg-amber-800/50 transition-colors flex-shrink-0"
          title="Return to live view"
        >
          ◀ LIVE
        </button>
      )}

      {/* Sim time display */}
      <span className="font-mono text-xs text-slate-300 flex-shrink-0">
        {isLive
          ? `T+${formatSimTime(simTime)}`
          : `⏱ ${formatSimTime(playbackPosition ? Number(playbackPosition) : 0)}`}
      </span>

      {/* Wall clock (live only) */}
      {isLive && wallClock && (
        <span className="text-[11px] text-slate-500 flex-shrink-0">
          {new Date(wallClock).toLocaleTimeString()}
        </span>
      )}

      {/* Historical scrubber (playback mode) */}
      {!isLive && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] text-slate-500 flex-shrink-0">T+0</span>
          <input
            type="range"
            min={0}
            max={Math.max(maxAvailableSimTime, 1)}
            step={5}
            value={scrubValue}
            onChange={handleSliderChange}
            className="flex-1 h-1.5 accent-blue-500 cursor-pointer min-w-0"
            aria-label="Historical time scrubber"
          />
          <span className="text-[10px] text-slate-400 flex-shrink-0 font-mono w-16 text-right">
            {isLoading ? '…' : `T+${formatSimTime(Math.max(maxAvailableSimTime, 1))}`}
          </span>
        </div>
      )}

      {/* Scenario progress bar (live mode only) */}
      {isLive && activeScenario !== 'normal' && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-orange-400 font-medium text-xs flex-shrink-0 truncate max-w-32">
            {scenario}
          </span>
          <div className="flex-1 max-w-48 h-1.5 bg-[#252840] rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 flex-shrink-0">{progress.toFixed(0)}%</span>
          <span className="text-[11px] text-slate-600 truncate">{stage}</span>
        </div>
      )}
    </div>
  )
})
