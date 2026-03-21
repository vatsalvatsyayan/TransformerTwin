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
        <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
          <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs">No anomalies detected</span>
          <span className="text-[10px] text-slate-600">System operating within normal parameters</span>
        </div>
      ) : (
        modes.map((mode) => <FMEACard key={mode.id} mode={mode} />)
      )}
    </div>
  )
})
