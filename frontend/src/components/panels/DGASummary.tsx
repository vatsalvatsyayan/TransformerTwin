// DGA Summary: TDCG, CO2/CO ratio, generation rates with time-to-threshold

import { memo } from 'react'
import { useStore } from '../../store'
import { SENSOR_META } from '../../lib/constants'
import { useSensorReading } from '../../store/selectors'
import type { SensorId } from '../../types/sensors'

// IEEE C57.104 TDCG thresholds (ppm)
const TDCG_THRESHOLDS = { caution: 720, warning: 1920, critical: 4630 }

// DGA gas sensor IDs in priority order for display
const DGA_GAS_IDS: SensorId[] = [
  'DGA_H2', 'DGA_CH4', 'DGA_C2H6', 'DGA_C2H4', 'DGA_C2H2', 'DGA_CO', 'DGA_CO2',
]

// ─── TDCG Status Bar ─────────────────────────────────────────────────────────

function TDCGBar({ value, status }: { value: number; status: string }) {
  const maxDisplay = TDCG_THRESHOLDS.critical
  const pct = Math.min(100, (value / maxDisplay) * 100)

  const barColor =
    status === 'CRITICAL' ? 'bg-red-500'
    : status === 'WARNING'  ? 'bg-orange-500'
    : status === 'CAUTION'  ? 'bg-yellow-500'
    : 'bg-emerald-500'

  const statusColor =
    status === 'CRITICAL' ? 'text-red-400 bg-red-900/30 border-red-700'
    : status === 'WARNING'  ? 'text-orange-400 bg-orange-900/30 border-orange-700'
    : status === 'CAUTION'  ? 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
    : 'text-green-400 bg-green-900/20 border-green-800'

  return (
    <div className={`rounded-lg border p-3 ${statusColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            TDCG — IEEE C57.104
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold font-mono text-white">{value.toLocaleString()}</span>
            <span className="text-slate-400 text-xs">ppm</span>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${statusColor}`}>
          {status}
        </span>
      </div>
      <div className="h-2 bg-[#252840] rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-slate-600 font-mono">
        <span>0</span>
        <span className="text-yellow-700">720 CAUTION</span>
        <span className="text-orange-700">1920 WARNING</span>
        <span className="text-red-700">4630 CRITICAL</span>
      </div>
    </div>
  )
}

// ─── Time to Threshold helper ─────────────────────────────────────────────────

function timeToThreshold(
  currentPpm: number,
  ratePerDay: number,
  threshold: number,
): string {
  if (ratePerDay <= 0 || currentPpm >= threshold) return '—'
  const daysRemaining = (threshold - currentPpm) / ratePerDay
  if (daysRemaining > 999) return '>999 days'
  if (daysRemaining < 1) return `${Math.round(daysRemaining * 24)}h`
  return `${daysRemaining.toFixed(0)} days`
}

// ─── Gas Rate Card ────────────────────────────────────────────────────────────

function GasRateRow({
  gasId,
  ratePpmPerDay,
  trend,
}: {
  gasId: SensorId
  ratePpmPerDay: number
  trend: string
}) {
  const reading = useSensorReading(gasId)
  const meta = SENSOR_META[gasId]
  if (!meta) return null

  const currentPpm = reading?.value ?? 0
  const label = gasId.replace('DGA_', '')
  const isRising = trend === 'RISING'

  // Time to next threshold level
  const currentStatus = reading?.status ?? 'NORMAL'
  const nextThreshold =
    currentStatus === 'NORMAL' ? meta.caution
    : currentStatus === 'CAUTION' ? meta.warning
    : currentStatus === 'WARNING' ? meta.critical
    : null

  const timeToNext = nextThreshold !== null && ratePpmPerDay > 0
    ? timeToThreshold(currentPpm, ratePpmPerDay, nextThreshold)
    : null

  const statusColor =
    currentStatus === 'CRITICAL' ? 'text-red-400'
    : currentStatus === 'WARNING'  ? 'text-orange-400'
    : currentStatus === 'CAUTION'  ? 'text-yellow-400'
    : 'text-slate-400'

  const trendColor = trend === 'RISING' ? 'text-orange-400' : trend === 'FALLING' ? 'text-green-400' : 'text-slate-600'

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#252840] last:border-0">
      <div className="w-12 flex-shrink-0">
        <span className={`text-[11px] font-mono font-semibold ${statusColor}`}>{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-slate-200">{currentPpm.toFixed(1)}</span>
          <span className="text-[9px] text-slate-600">ppm</span>
          <span className={`text-[9px] ${trendColor}`}>
            {trend === 'RISING' ? '↑' : trend === 'FALLING' ? '↓' : '→'}
          </span>
        </div>
        {isRising && ratePpmPerDay > 0.01 && (
          <div className="text-[9px] text-slate-600 mt-0.5">
            +{ratePpmPerDay.toFixed(1)} ppm/day
          </div>
        )}
      </div>

      {/* Time to next threshold */}
      {timeToNext && timeToNext !== '—' && (
        <div
          className="flex-shrink-0 text-right"
          title={`Time to reach ${currentStatus === 'NORMAL' ? 'CAUTION' : currentStatus === 'CAUTION' ? 'WARNING' : 'CRITICAL'} threshold at current rate`}
        >
          <div className="text-[9px] text-slate-600 leading-tight">to {currentStatus === 'NORMAL' ? 'CAUTION' : currentStatus === 'CAUTION' ? 'WARNING' : 'CRITICAL'}</div>
          <div className={`text-[10px] font-mono font-semibold ${
            timeToNext.includes('h') ? 'text-red-400'
            : parseFloat(timeToNext) < 7 ? 'text-orange-400'
            : parseFloat(timeToNext) < 30 ? 'text-yellow-400'
            : 'text-slate-400'
          }`}>{timeToNext}</div>
        </div>
      )}

      {/* Status dot */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        currentStatus === 'CRITICAL' ? 'bg-red-500'
        : currentStatus === 'WARNING'  ? 'bg-orange-500'
        : currentStatus === 'CAUTION'  ? 'bg-yellow-500'
        : 'bg-slate-700'
      }`} />
    </div>
  )
}

// ─── Main DGA Summary ─────────────────────────────────────────────────────────

export const DGASummary = memo(function DGASummary() {
  const analysis = useStore((s) => s.analysis)

  if (!analysis) {
    return <div className="p-4 text-xs text-slate-500">No DGA data yet.</div>
  }

  const { tdcg, co2_co_ratio, gas_rates } = analysis

  // CO2/CO ratio health indicator
  const ratio = co2_co_ratio.value
  const ratioStatus =
    ratio > 0 && ratio < 5 ? 'CRITICAL'
    : ratio < 9 ? 'CAUTION'
    : ratio > 15 ? 'CAUTION'
    : 'NORMAL'

  const ratioColor =
    ratioStatus === 'CRITICAL' ? 'text-red-400'
    : ratioStatus === 'CAUTION'  ? 'text-yellow-400'
    : 'text-green-400'

  return (
    <div className="p-3 space-y-3 text-xs">

      {/* TDCG Status — IEEE C57.104 */}
      <TDCGBar value={tdcg.value} status={tdcg.status} />

      {/* CO2/CO Ratio — Paper Insulation Health */}
      <div className="rounded-lg border border-[#2d3148] bg-[#161927] p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            CO₂/CO Ratio — Paper Insulation
          </span>
          <span className={`text-xs font-bold font-mono ${ratioColor}`}>
            {ratio.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#252840] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                ratioStatus === 'CRITICAL' ? 'bg-red-500'
                : ratioStatus === 'CAUTION' ? 'bg-yellow-500'
                : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (ratio / 20) * 100).toFixed(1)}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-600 flex-shrink-0 w-8 text-right font-mono">
            /20
          </span>
        </div>
        <p className="text-[9px] text-slate-600 mt-1.5 leading-relaxed">
          {co2_co_ratio.interpretation}
        </p>
        <div className="flex gap-3 mt-1.5 text-[9px] text-slate-700">
          <span>&lt;5 = active paper fault</span>
          <span>5–13 = normal aging</span>
          <span>&gt;13 = oil oxidation</span>
        </div>
      </div>

      {/* Gas Rates with Time-to-Threshold */}
      <div className="rounded-lg border border-[#2d3148] bg-[#161927] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Gas Concentration & Rate
          </span>
          <span className="text-[9px] text-slate-700">→ time to next threshold</span>
        </div>
        <div>
          {DGA_GAS_IDS.map((gasId) => {
            const rateData = gas_rates[gasId]
            if (!rateData) return null
            return (
              <GasRateRow
                key={gasId}
                gasId={gasId}
                ratePpmPerDay={rateData.rate_ppm_per_day}
                trend={rateData.trend}
              />
            )
          })}
        </div>
      </div>

      {/* Standards reference footer */}
      <div className="flex items-center gap-2 text-[9px] text-slate-700 px-1">
        <span className="bg-slate-800 px-1.5 py-0.5 rounded">IEEE C57.104</span>
        <span className="bg-slate-800 px-1.5 py-0.5 rounded">IEC 60599</span>
        <span className="flex-1 text-right">rates computed over DGA history</span>
      </div>
    </div>
  )
})
