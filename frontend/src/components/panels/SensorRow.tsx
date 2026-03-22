// Single sensor row: name, value, status dot, trend arrow, limit bar, sparkline,
// and (for thermal sensors) model-vs-actual deviation — the core digital twin signal.

import { memo } from 'react'
import { StatusDot } from '../common/StatusDot'
import { SensorSparkline } from '../charts/SensorSparkline'
import { useSensorHistory } from '../../hooks/useSensorHistory'
import { useSensorReading } from '../../store/selectors'
import { SENSOR_META } from '../../lib/constants'
import { formatSensorValue } from '../../lib/formatters'
import type { SensorId } from '../../types/sensors'

// Thermal sensors that have a physics-based model prediction (IEC 60076-7)
const THERMAL_MODEL_SENSORS = new Set<SensorId>(['TOP_OIL_TEMP', 'WINDING_TEMP', 'BOT_OIL_TEMP'])

export interface SensorRowProps {
  sensorId: SensorId
}

// ─── Trend helpers ───────────────────────────────────────────────────────────

type Trend = 'rising' | 'falling' | 'stable'

function computeTrend(values: number[]): Trend {
  if (values.length < 4) return 'stable'
  const recent = values.slice(-4)
  const first  = recent[0]
  const last   = recent[recent.length - 1]
  if (first === 0) return 'stable'
  const pctChange = ((last - first) / Math.abs(first)) * 100
  if (pctChange >  1.0) return 'rising'
  if (pctChange < -1.0) return 'falling'
  return 'stable'
}

function TrendArrow({ trend, status }: { trend: Trend; status: string }) {
  const isAnomalous = status === 'CAUTION' || status === 'WARNING' || status === 'CRITICAL'
  if (trend === 'rising')  return <span className={`text-[10px] flex-shrink-0 ${isAnomalous ? 'text-orange-400' : 'text-slate-500'}`} title="Rising">↑</span>
  if (trend === 'falling') return <span className="text-[10px] flex-shrink-0 text-slate-500" title="Falling">↓</span>
  return <span className="text-[10px] flex-shrink-0 text-slate-700" title="Stable">→</span>
}

// ─── Limit progress bar ───────────────────────────────────────────────────────

function LimitBar({ value, sensorId, status }: { value: number; sensorId: SensorId; status: string }) {
  const meta = SENSOR_META[sensorId]
  if (!meta) return null
  const pct = Math.min(1, Math.max(0, value / meta.critical))
  const barColor =
    status === 'CRITICAL' ? 'bg-red-500'
    : status === 'WARNING'  ? 'bg-orange-500'
    : status === 'CAUTION'  ? 'bg-yellow-500'
    : 'bg-emerald-600'
  return (
    <div className="w-10 flex-shrink-0" title={`${Math.round(pct * 100)}% of limit`}>
      <div className="h-[3px] bg-[#252840] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${(pct * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  )
}

// ─── Model vs Actual deviation (digital twin core signal) ─────────────────────
// Shows the IEC 60076-7 physics model prediction alongside the actual reading.
// The deviation (actual − model) is the fault signature — not statistical noise.

function ModelDeviation({ actual, expected, unit }: { actual: number; expected: number; unit: string }) {
  const deviation = actual - expected
  const absDev = Math.abs(deviation)

  // Only show when deviation is meaningful (>0.5°C)
  if (absDev < 0.5) return null

  const sign = deviation > 0 ? '+' : '−'
  const isHot = deviation > 0

  // Color-code by deviation magnitude (>5°C caution, >10°C warning, >15°C critical)
  const devColor =
    absDev >= 15 ? 'text-red-400'
    : absDev >= 10 ? 'text-orange-400'
    : absDev >= 5  ? 'text-yellow-400'
    : 'text-slate-500'

  return (
    <div
      className="flex items-center gap-1 flex-shrink-0"
      title={`IEC 60076-7 model predicts ${expected.toFixed(1)}${unit}. Actual ${isHot ? 'exceeds' : 'is below'} model by ${absDev.toFixed(1)}${unit}.`}
    >
      <span className="text-[8px] text-slate-600 font-mono">mdl</span>
      <span className={`text-[9px] font-mono font-semibold ${devColor}`}>
        {sign}{absDev.toFixed(1)}{unit}
      </span>
    </div>
  )
}

// ─── SensorRow ────────────────────────────────────────────────────────────────

export const SensorRow = memo(function SensorRow({ sensorId }: SensorRowProps) {
  const { latestValue, points } = useSensorHistory(sensorId)
  const reading = useSensorReading(sensorId)
  const meta    = SENSOR_META[sensorId]
  const label   = meta?.label ?? sensorId
  const unit    = meta?.unit  ?? ''

  const status  = reading?.status ?? 'NORMAL'
  const isOnOff = status === 'ON' || status === 'OFF'

  const trend = isOnOff ? 'stable' : computeTrend(points.map((p) => p.value))

  // Physics-based model prediction (only for thermal sensors with IEC 60076-7 model)
  const expected = reading?.expected
  const hasModelDev = (
    THERMAL_MODEL_SENSORS.has(sensorId) &&
    expected !== undefined &&
    latestValue !== undefined
  )

  return (
    <div className="flex flex-col border-b border-[#252840] hover:bg-[#252840] transition-colors">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <StatusDot status={status} size="sm" />
        <span className="flex-1 text-xs text-slate-300 truncate">{label}</span>

        {!isOnOff && <TrendArrow trend={trend} status={status} />}

        {/* Model deviation badge — only for thermal sensors */}
        {hasModelDev && (
          <ModelDeviation actual={latestValue!} expected={expected!} unit={unit} />
        )}

        <span className="text-xs font-mono w-20 text-right">
          {status === 'ON'
            ? <span className="text-green-400">ON</span>
            : status === 'OFF'
            ? <span className="text-slate-500">OFF</span>
            : <span className="text-slate-200">{latestValue !== undefined ? formatSensorValue(latestValue, unit) : '—'}</span>}
        </span>

        {!isOnOff && latestValue !== undefined && (
          <LimitBar value={latestValue} sensorId={sensorId} status={status} />
        )}

        <div className="w-20 flex-shrink-0">
          <SensorSparkline sensorId={sensorId} status={status} height={24} />
        </div>
      </div>

      {/* Physics model context line — visible when deviation is significant */}
      {hasModelDev && Math.abs(latestValue! - expected!) >= 2.0 && (
        <div className="flex items-center gap-2 px-3 pb-1 -mt-0.5">
          <div className="w-1.5 flex-shrink-0" /> {/* spacer for status dot width */}
          <span className="text-[9px] text-slate-600">
            IEC model: <span className="font-mono text-slate-500">{expected!.toFixed(1)}{unit}</span>
            <span className="mx-1">·</span>
            actual: <span className={`font-mono ${
              Math.abs(latestValue! - expected!) >= 15 ? 'text-red-400'
              : Math.abs(latestValue! - expected!) >= 10 ? 'text-orange-400'
              : Math.abs(latestValue! - expected!) >= 5  ? 'text-yellow-400'
              : 'text-slate-400'
            }`}>{latestValue!.toFixed(1)}{unit}</span>
          </span>
        </div>
      )}
    </div>
  )
})
