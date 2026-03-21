// Simulation speed multiplier buttons

import { memo } from 'react'
import { useStore } from '../../store'
import { api } from '../../lib/api'

const SPEED_OPTIONS = [1, 10, 30, 60] as const

export const SpeedControl = memo(function SpeedControl() {
  const speedMultiplier = useStore((s) => s.speedMultiplier)
  const setSpeedMultiplier = useStore((s) => s.setSpeedMultiplier)

  const handleSpeedChange = async (speed: number) => {
    try {
      await api.setSpeed(speed)
      setSpeedMultiplier(speed)
    } catch (err) {
      console.error('Failed to set speed:', err)
    }
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-slate-500 mr-1">Speed:</span>
      {SPEED_OPTIONS.map((speed) => (
        <button
          key={speed}
          onClick={() => void handleSpeedChange(speed)}
          className={`px-2 py-0.5 rounded font-mono transition-colors ${
            speedMultiplier === speed
              ? 'bg-blue-600 text-white'
              : 'bg-[#252840] text-slate-400 hover:bg-[#2d3148]'
          }`}
        >
          {speed}×
        </button>
      ))}
    </div>
  )
})
