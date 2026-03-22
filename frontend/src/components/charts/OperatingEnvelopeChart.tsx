// Operating Envelope Chart — the definitive digital twin visualization.
//
// Shows Load% (X-axis) vs Top Oil Temperature (Y-axis) with:
//   • The IEC 60076-7 thermal model's predicted temperature curve (the "expected" envelope)
//   • Historical operating points (actual readings, colored by model deviation)
//   • The current live operating point
//   • Design limit lines (IEC/IEEE thresholds)
//
// The gap between where the live point sits and the model curve is the fault signal.
// A healthy transformer's points cluster around the curve; a fault pushes them above it.

import { memo, useMemo } from 'react'
import {
  Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart,
} from 'recharts'
import { useStore } from '../../store'

// ─── IEC 60076-7 thermal model parameters (must match backend config.py) ─────
// These constants define the expected top-oil temperature rise at rated load under ONAN.
// ONAF cooling reduces the steady-state rise by a factor.

const AMBIENT_BASELINE_C = 28   // typical summer ambient for envelope calculation
const TOP_OIL_RISE_RATED_ONAN = 45.0  // ΔΘ_TO_rated at 100% load, ONAN (°C)
const TOP_OIL_RISE_RATED_ONAF = 32.0  // ONAF reduces oil rise
const TOP_OIL_RISE_RATED_OFAF = 23.0  // OFAF further reduces oil rise
const OIL_EXPONENT_N = 0.8            // IEC 60076-7 Table 3 (ONAN)
const CAUTION_TEMP_C = 75
const WARNING_TEMP_C = 85
const CRITICAL_TEMP_C = 95

/** IEC 60076-7 steady-state top oil temp for given load fraction and cooling mode */
function iecModelTopOil(loadPct: number, coolingMode: string, ambient: number): number {
  const k = loadPct / 100
  const ratedRise =
    coolingMode === 'OFAF' ? TOP_OIL_RISE_RATED_OFAF
    : coolingMode === 'ONAF' ? TOP_OIL_RISE_RATED_ONAF
    : TOP_OIL_RISE_RATED_ONAN
  const rise = ratedRise * Math.pow(k, 2 * OIL_EXPONENT_N)
  return ambient + rise
}

// ─── Build model curve (expected temperature at each load %) ─────────────────

function buildModelCurve(coolingMode: string, ambient: number) {
  const points = []
  for (let load = 0; load <= 120; load += 5) {
    points.push({
      load,
      expected: parseFloat(iecModelTopOil(load, coolingMode, ambient).toFixed(1)),
    })
  }
  return points
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function EnvelopeTooltip({ active, payload }: { active?: boolean; payload?: { payload: { load: number; actual?: number; expected?: number; deviation?: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const hasDev = d.actual !== undefined && d.expected !== undefined

  return (
    <div className="bg-[#1e2238] border border-[#3d4268] rounded-lg p-2.5 text-xs shadow-xl">
      <div className="font-semibold text-slate-300 mb-1">Load: {d.load}%</div>
      {d.expected !== undefined && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-slate-400">Model:</span>
          <span className="font-mono text-blue-300">{d.expected.toFixed(1)}°C</span>
        </div>
      )}
      {d.actual !== undefined && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-slate-400">Actual:</span>
          <span className="font-mono text-orange-300">{d.actual.toFixed(1)}°C</span>
        </div>
      )}
      {hasDev && d.deviation !== undefined && Math.abs(d.deviation) > 0.5 && (
        <div className={`mt-1 pt-1 border-t border-[#3d4268] font-mono text-[10px] ${
          d.deviation > 10 ? 'text-red-400' : d.deviation > 5 ? 'text-orange-400' : 'text-yellow-400'
        }`}>
          Deviation: {d.deviation > 0 ? '+' : ''}{d.deviation.toFixed(1)}°C above model
        </div>
      )}
    </div>
  )
}

// ─── Main Chart ───────────────────────────────────────────────────────────────

export const OperatingEnvelopeChart = memo(function OperatingEnvelopeChart() {
  const history = useStore((s) => s.history)
  const readings = useStore((s) => s.readings)
  const scenario = useStore((s) => s.activeScenario)

  // Current cooling mode from oil pump / fan status
  const fanBank1 = readings['FAN_BANK_1']
  const oilPump  = readings['OIL_PUMP_1']
  const coolingMode =
    oilPump?.status === 'ON' ? 'OFAF'
    : fanBank1?.status === 'ON' ? 'ONAF'
    : 'ONAN'

  // Build the IEC 60076-7 model curve for the current cooling mode
  const modelCurve = useMemo(
    () => buildModelCurve(coolingMode, AMBIENT_BASELINE_C),
    [coolingMode],
  )

  // Build historical operating points (last 120 load/top-oil pairs)
  const historicalPoints = useMemo(() => {
    const loadHist   = history['LOAD_CURRENT'] ?? []
    const topOilHist = history['TOP_OIL_TEMP'] ?? []
    if (loadHist.length === 0 || topOilHist.length === 0) return []

    // Align on sim_time: for each load reading, find nearest top-oil reading
    const POINTS = 80
    const step = Math.max(1, Math.floor(loadHist.length / POINTS))
    return loadHist
      .filter((_, i) => i % step === 0)
      .map((lp) => {
        const simT = lp.sim_time
        let bestOil = topOilHist[0]
        let bestDiff = Math.abs(bestOil.sim_time - simT)
        for (const op of topOilHist) {
          const diff = Math.abs(op.sim_time - simT)
          if (diff < bestDiff) { bestOil = op; bestDiff = diff }
        }
        const actual = bestOil.value
        const expectedAtLoad = parseFloat(iecModelTopOil(lp.value, coolingMode, AMBIENT_BASELINE_C).toFixed(1))
        return {
          load: parseFloat(lp.value.toFixed(1)),
          actual,
          expected: expectedAtLoad,
          deviation: parseFloat((actual - expectedAtLoad).toFixed(1)),
        }
      })
  }, [history, coolingMode])

  // Current live point
  const currentLoad   = readings['LOAD_CURRENT']?.value ?? 0
  const currentTopOil = readings['TOP_OIL_TEMP']?.value ?? 0
  const currentExpected = parseFloat(iecModelTopOil(currentLoad, coolingMode, AMBIENT_BASELINE_C).toFixed(1))
  const currentDeviation = parseFloat((currentTopOil - currentExpected).toFixed(1))

  // Color historical points by deviation magnitude
  const coloredHistory = historicalPoints.map((p) => ({
    ...p,
    fill:
      p.deviation >= 10 ? '#ef4444'   // red: >10°C above model
      : p.deviation >= 5  ? '#f97316'  // orange: 5-10°C
      : p.deviation >= 2  ? '#eab308'  // yellow: 2-5°C
      : '#475569',                     // slate: on-model (healthy)
  }))

  const hasFault = scenario !== 'normal'

  return (
    <div className="p-3 space-y-3 text-xs">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            Operating Envelope — Load vs Temperature
          </h3>
          <span className="text-[9px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
            IEC 60076-7 / {coolingMode}
          </span>
        </div>
        <p className="text-[9px] text-slate-700 leading-relaxed">
          Blue curve = model prediction at {coolingMode} cooling, {AMBIENT_BASELINE_C}°C ambient.
          Points above curve indicate fault-driven thermal elevation.
        </p>
      </div>

      {/* Current operating point callout */}
      <div className={`rounded-lg border p-2.5 flex items-center gap-3 ${
        currentDeviation >= 10 ? 'bg-red-900/20 border-red-700'
        : currentDeviation >= 5 ? 'bg-orange-900/20 border-orange-700'
        : currentDeviation >= 2 ? 'bg-yellow-900/10 border-yellow-800'
        : 'bg-[#161927] border-[#2d3148]'
      }`}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          currentDeviation >= 10 ? 'bg-red-500'
          : currentDeviation >= 5 ? 'bg-orange-500'
          : currentDeviation >= 2 ? 'bg-yellow-500'
          : 'bg-emerald-500'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400">Load: <span className="font-mono text-white">{currentLoad.toFixed(0)}%</span></span>
            <span className="text-slate-400">Top Oil: <span className="font-mono text-white">{currentTopOil.toFixed(1)}°C</span></span>
            <span className="text-slate-400">Model: <span className="font-mono text-blue-300">{currentExpected.toFixed(1)}°C</span></span>
          </div>
          {Math.abs(currentDeviation) >= 2 && (
            <div className={`text-[10px] font-semibold mt-0.5 ${
              currentDeviation >= 10 ? 'text-red-400' : currentDeviation >= 5 ? 'text-orange-400' : 'text-yellow-400'
            }`}>
              {currentDeviation > 0 ? '+' : ''}{currentDeviation.toFixed(1)}°C above IEC 60076-7 model
              {hasFault && ' — fault scenario active'}
            </div>
          )}
          {Math.abs(currentDeviation) < 2 && (
            <div className="text-[9px] text-slate-600 mt-0.5">Operating within model prediction ±2°C</div>
          )}
        </div>
      </div>

      {/* Scatter chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 5, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#252840" strokeDasharray="3 3" />
            <XAxis
              dataKey="load"
              type="number"
              domain={[0, 120]}
              label={{ value: 'Load (%)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
            />
            <YAxis
              domain={[20, 110]}
              label={{ value: '°C', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 10 }}
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
            />
            <Tooltip content={<EnvelopeTooltip />} />

            {/* Design limit lines */}
            <ReferenceLine y={CRITICAL_TEMP_C} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1}
              label={{ value: `${CRITICAL_TEMP_C}°C CRITICAL`, fill: '#ef4444', fontSize: 8, position: 'insideTopRight' }} />
            <ReferenceLine y={WARNING_TEMP_C} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1}
              label={{ value: `${WARNING_TEMP_C}°C WARNING`, fill: '#f97316', fontSize: 8, position: 'insideTopRight' }} />
            <ReferenceLine y={CAUTION_TEMP_C} stroke="#eab308" strokeDasharray="4 4" strokeWidth={1}
              label={{ value: `${CAUTION_TEMP_C}°C CAUTION`, fill: '#eab308', fontSize: 8, position: 'insideTopRight' }} />
            <ReferenceLine x={100} stroke="#64748b" strokeDasharray="3 3" strokeWidth={1} />

            {/* IEC 60076-7 model curve */}
            <Line
              data={modelCurve}
              dataKey="expected"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="IEC Model"
              type="monotone"
            />

            {/* Historical operating points */}
            {coloredHistory.map((p, i) => (
              <Scatter
                key={i}
                data={[p]}
                fill={p.fill}
                opacity={0.5}
                r={2}
              />
            ))}

            {/* Current live point (larger, highlighted) */}
            <Scatter
              data={[{ load: currentLoad, actual: currentTopOil, expected: currentExpected, deviation: currentDeviation }]}
              fill={
                currentDeviation >= 10 ? '#ef4444'
                : currentDeviation >= 5  ? '#f97316'
                : currentDeviation >= 2  ? '#eab308'
                : '#22c55e'
              }
              r={5}
              opacity={1}
              name="Current"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-blue-500 rounded" />
          <span className="text-slate-500">IEC 60076-7 model ({coolingMode})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-500">On-model (&lt;2°C deviation)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-slate-500">+2–5°C above model</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-slate-500">&gt;10°C above model — fault</span>
        </div>
      </div>

      {/* Explanation tiles */}
      <div className="grid grid-cols-1 gap-2 pt-1 border-t border-[#2d3148]">
        <div className="bg-[#161927] rounded-lg border border-[#2d3148] p-2.5">
          <p className="text-[10px] font-semibold text-blue-400 mb-1">Why This Matters</p>
          <p className="text-[9px] text-slate-500 leading-relaxed">
            Traditional monitoring only alerts when absolute temperature exceeds a fixed threshold.
            A digital twin compares actual readings to the physics model's prediction for the
            current operating conditions. A temperature that is 10°C above model at 50% load
            is a fault signal — even if the absolute value looks normal. This "actual vs. expected"
            paradigm is how GE Vernova SmartSignal catches faults 6–8 weeks earlier than threshold alarms.
          </p>
        </div>
      </div>
    </div>
  )
})
