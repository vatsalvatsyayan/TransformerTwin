// Physics Correlation Chart — proves the IEC 60076-7 thermal model is working
// Shows Load% driving Top Oil Temp and Winding Temp in sync (dual Y-axis)

import { memo, useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useStore } from '../../store'
import type { SensorHistoryPoint } from '../../types/sensors'

// ─── Build aligned dataset ────────────────────────────────────────────────────

interface CorrelationPoint {
  simTime: number
  load:    number | null
  topOil:  number | null
  winding: number | null
  botOil:  number | null
}

/**
 * Aligns three separate sensor histories on sim_time and down-samples to ≤120 points
 * for smooth rendering.
 */
function buildDataset(
  loadHistory:    SensorHistoryPoint[],
  topOilHistory:  SensorHistoryPoint[],
  windingHistory: SensorHistoryPoint[],
  botOilHistory:  SensorHistoryPoint[],
): CorrelationPoint[] {
  if (loadHistory.length === 0) return []

  // Use load history as the backbone (sampled); look up closest values in other series
  const POINTS = 120
  const step = Math.max(1, Math.floor(loadHistory.length / POINTS))
  const sampled = loadHistory.filter((_, i) => i % step === 0)

  const nearest = (history: SensorHistoryPoint[], t: number): number | null => {
    if (history.length === 0) return null
    let best = history[0]
    let bestDiff = Math.abs(best.sim_time - t)
    for (const p of history) {
      const diff = Math.abs(p.sim_time - t)
      if (diff < bestDiff) { best = p; bestDiff = diff }
    }
    return best.value
  }

  return sampled.map((lp) => ({
    simTime: lp.sim_time,
    load:    lp.value,
    topOil:  nearest(topOilHistory,  lp.sim_time),
    winding: nearest(windingHistory, lp.sim_time),
    botOil:  nearest(botOilHistory,  lp.sim_time),
  }))
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d27] border border-[#2d3148] rounded-lg p-2 text-[11px] shadow-xl">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-mono font-medium">{typeof p.value === 'number' ? p.value.toFixed(1) : '—'}</span>
        </div>
      ))}
    </div>
  )
}

// ─── CorrelationChart ─────────────────────────────────────────────────────────

export const CorrelationChart = memo(function CorrelationChart() {
  const loadHistory    = useStore((s) => s.history['LOAD_CURRENT']    ?? [])
  const topOilHistory  = useStore((s) => s.history['TOP_OIL_TEMP']    ?? [])
  const windingHistory = useStore((s) => s.history['WINDING_TEMP']    ?? [])
  const botOilHistory  = useStore((s) => s.history['BOT_OIL_TEMP']    ?? [])

  const data = useMemo(
    () => buildDataset(loadHistory, topOilHistory, windingHistory, botOilHistory),
    [loadHistory, topOilHistory, windingHistory, botOilHistory],
  )

  if (data.length < 5) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
        <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l5-5 4 4 5-6 4 3" />
        </svg>
        <span className="text-xs font-medium">Collecting sensor history…</span>
        <span className="text-[10px]">Chart appears after ~10 seconds of data.</span>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="mb-2">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
          Physics Correlation — Load % vs Thermal Response
        </h3>
        <p className="text-[9px] text-slate-600 mt-0.5">
          IEC 60076-7: as load increases, oil and winding temperatures follow exponential lag dynamics.
          Divergence from expected gradient indicates a developing fault.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252840" />

          <XAxis
            dataKey="simTime"
            tickFormatter={(v: number) => `${Math.floor(v / 3600)}h${Math.floor((v % 3600) / 60)}m`}
            tick={{ fill: '#64748b', fontSize: 9 }}
            axisLine={{ stroke: '#2d3148' }}
            tickLine={false}
          />

          {/* Left Y-axis: Load % */}
          <YAxis
            yAxisId="load"
            domain={[0, 130]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: '#64748b', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />

          {/* Right Y-axis: Temperature °C */}
          <YAxis
            yAxisId="temp"
            orientation="right"
            domain={[0, 150]}
            tickFormatter={(v: number) => `${v}°`}
            tick={{ fill: '#64748b', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />

          {/* IEC reference lines — max operational limits */}
          <ReferenceLine yAxisId="temp" y={140} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Max winding 140°C', position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }} />
          <ReferenceLine yAxisId="temp" y={95}  stroke="#f97316" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Max top-oil 95°C',   position: 'insideTopRight', fontSize: 8, fill: '#f97316' }} />
          <ReferenceLine yAxisId="load" y={100} stroke="#6366f1" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Rated load 100%',    position: 'insideTopLeft',  fontSize: 8, fill: '#6366f1' }} />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            formatter={(value: string) => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />

          {/* Load factor */}
          <Line
            yAxisId="load"
            type="monotone"
            dataKey="load"
            name="Load %"
            stroke="#818cf8"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />

          {/* Top oil temperature */}
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="topOil"
            name="Top Oil °C"
            stroke="#f97316"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />

          {/* Winding hot-spot temperature */}
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="winding"
            name="Winding °C"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />

          {/* Bottom oil (coolest) */}
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="botOil"
            name="Bot Oil °C"
            stroke="#94a3b8"
            strokeWidth={1}
            dot={false}
            strokeDasharray="3 3"
            activeDot={{ r: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Physics explanation */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
        <div className="bg-[#161927] rounded p-2 border border-[#2d3148]">
          <div className="text-indigo-400 font-semibold mb-0.5">Load ↑ → Temps ↑</div>
          <div className="text-slate-600">IEC 60076-7 exponential thermal lag: temps follow load with ~30–60 min time constant.</div>
        </div>
        <div className="bg-[#161927] rounded p-2 border border-[#2d3148]">
          <div className="text-orange-400 font-semibold mb-0.5">Thermal Gradient</div>
          <div className="text-slate-600">Winding &gt; Top Oil &gt; Bot Oil always. Gradient narrows when cooling is active (fans ON).</div>
        </div>
        <div className="bg-[#161927] rounded p-2 border border-[#2d3148]">
          <div className="text-red-400 font-semibold mb-0.5">Fault Signature</div>
          <div className="text-slate-600">Winding temp rising faster than top oil (widening gap) indicates a developing hot-spot.</div>
        </div>
      </div>
    </div>
  )
})
