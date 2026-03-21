// Failure mode diagnostic panel

import { memo } from 'react'
import { FMEACard } from './FMEACard'
import { useStore } from '../../store'

export const FMEAPanel = memo(function FMEAPanel() {
  const response = useStore((s) => s.response)
  const modes = response?.active_modes ?? []

  return (
    <div className="p-3">
      {modes.length === 0 ? (
        <div className="text-xs text-slate-500 text-center py-8">
          No active failure modes detected.
        </div>
      ) : (
        modes.map((mode) => <FMEACard key={mode.id} mode={mode} />)
      )}
    </div>
  )
})
