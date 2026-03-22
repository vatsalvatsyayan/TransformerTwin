// Full-screen overlay shown when protection relay operates (terminal failure Stage 6).
// Reads terminalFailure from Zustand store — unmounts automatically when reset to normal.

import { useState } from 'react'
import { useStore } from '../../store'
import { api } from '../../lib/api'

const FAULT_CHAIN = [
  { stage: 1, label: 'Cooling System Failure',     icon: '❄️' },
  { stage: 2, label: 'Hot Spot Formation',          icon: '🌡️' },
  { stage: 3, label: 'Oil & Paper Deterioration',   icon: '⚗️' },
  { stage: 4, label: 'Partial Discharge',           icon: '⚡' },
  { stage: 5, label: 'Arc Development',             icon: '🔴' },
  { stage: 6, label: 'Terminal Failure',            icon: '💀' },
]

export function TerminalFailureOverlay() {
  const elapsedSimTime = useStore((s) => s.elapsedSimTime)
  const [resetting, setResetting] = useState(false)

  const handleReset = async () => {
    setResetting(true)
    try {
      await api.triggerScenario('normal')
    } catch (err) {
      console.error('[TerminalFailureOverlay] reset failed:', err)
      setResetting(false)
    }
    // Overlay unmounts automatically via terminalFailure→false in store
    // once the backend sends scenario_update with scenario_id='normal'
  }

  const simMinutes = Math.round(elapsedSimTime / 60)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 bg-gradient-to-b from-black/95 to-red-950/90 backdrop-blur-sm
                 animate-fadeIn"
      style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
    >
      {/* Pulsing warning header */}
      <div className="mb-8 text-center">
        <p className="text-red-400 text-5xl font-black tracking-tight animate-pulse mb-3">
          ⚡ PROTECTION RELAY OPERATED
        </p>
        <p className="text-red-300 text-xl font-bold uppercase tracking-widest">
          TRANSFORMER TRIPPED — UNIT OFFLINE
        </p>
        <p className="mt-2 text-slate-400 text-sm">
          Failure occurred at sim-time {simMinutes} min
          {' '}({elapsedSimTime.toFixed(0)} s)
        </p>
      </div>

      {/* Fault chain timeline */}
      <div className="mb-10 bg-black/60 border border-red-900/60 rounded-xl px-8 py-6 w-full max-w-sm">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4 text-center">
          Fault Chain
        </p>
        <div className="flex flex-col gap-0">
          {FAULT_CHAIN.map((item, idx) => {
            const isTerminal = item.stage === 6
            return (
              <div key={item.stage} className="flex items-start gap-3">
                {/* Dot + connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0
                      ${isTerminal ? 'bg-red-600 border-2 border-red-400' : 'bg-slate-700 border border-slate-500'}`}
                  >
                    {item.stage}
                  </div>
                  {idx < FAULT_CHAIN.length - 1 && (
                    <div className="w-px h-5 bg-slate-700" />
                  )}
                </div>
                {/* Label */}
                <div className={`pb-5 ${isTerminal ? '' : ''}`}>
                  <span className="text-sm mr-1.5">{item.icon}</span>
                  <span
                    className={`text-sm font-medium ${isTerminal ? 'text-red-400 font-bold' : 'text-slate-300'}`}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={() => void handleReset()}
        disabled={resetting}
        className="px-8 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-500
                   text-white font-semibold rounded-lg transition-colors disabled:opacity-50
                   disabled:cursor-not-allowed text-sm"
      >
        {resetting ? 'Resetting…' : 'Reset to Normal Operation'}
      </button>

      <p className="mt-3 text-slate-600 text-xs text-center max-w-xs">
        Do not re-energise without full IEC 60076-7 post-fault assessment.
        This reset is for simulation purposes only.
      </p>
    </div>
  )
}
