// What-if simulation controls + projections — skeleton

import { memo, useState } from 'react'
import { ProjectionChart } from '../charts/ProjectionChart'
import { api } from '../../lib/api'
import type { SimulationResponse, CoolingMode } from '../../types/simulation'

export const WhatIfPanel = memo(function WhatIfPanel() {
  const [loadPct, setLoadPct] = useState(80)
  const [ambientC, setAmbientC] = useState(25)
  const [cooling, setCooling] = useState<CoolingMode>('ONAF')
  const [horizonDays, setHorizonDays] = useState(7)
  const [result, setResult] = useState<SimulationResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const runSimulation = async () => {
    setLoading(true)
    try {
      const res = await api.runSimulation({
        load_percent: loadPct,
        ambient_temp_c: ambientC,
        cooling_mode: cooling,
        time_horizon_days: horizonDays,
      })
      setResult(res)
    } catch (err) {
      console.error('Simulation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="space-y-2">
        <label className="flex items-center justify-between text-slate-400">
          Load (%) <span className="font-mono text-slate-200">{loadPct}%</span>
        </label>
        <input type="range" min={0} max={150} value={loadPct} onChange={(e) => setLoadPct(Number(e.target.value))} className="w-full accent-blue-500" />

        <label className="flex items-center justify-between text-slate-400">
          Ambient (°C) <span className="font-mono text-slate-200">{ambientC}°C</span>
        </label>
        <input type="range" min={-10} max={50} value={ambientC} onChange={(e) => setAmbientC(Number(e.target.value))} className="w-full accent-blue-500" />

        <label className="flex items-center justify-between text-slate-400">
          Cooling Mode
          <select value={cooling} onChange={(e) => setCooling(e.target.value as CoolingMode)} className="bg-[#252840] border border-[#3d4168] text-slate-300 text-xs rounded px-2 py-0.5">
            <option value="ONAN">ONAN</option>
            <option value="ONAF">ONAF</option>
            <option value="OFAF">OFAF</option>
          </select>
        </label>

        <label className="flex items-center justify-between text-slate-400">
          Horizon (days) <span className="font-mono text-slate-200">{horizonDays}d</span>
        </label>
        <input type="range" min={1} max={30} value={horizonDays} onChange={(e) => setHorizonDays(Number(e.target.value))} className="w-full accent-blue-500" />
      </div>

      <button
        onClick={() => void runSimulation()}
        disabled={loading}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
      >
        {loading ? 'Running…' : 'Run Simulation'}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-2">
              <div className="text-slate-500">Hot Spot</div>
              <div className="font-mono text-red-400 text-lg">{result.projected_hotspot_temp_c.toFixed(1)}°C</div>
            </div>
            <div className="card p-2">
              <div className="text-slate-500">Top Oil</div>
              <div className="font-mono text-orange-400 text-lg">{result.projected_top_oil_temp_c.toFixed(1)}°C</div>
            </div>
          </div>
          <div className="text-slate-400 text-[10px]">{result.aging_interpretation}</div>
          <ProjectionChart data={result.projection_timeline} />
        </div>
      )}
    </div>
  )
})
