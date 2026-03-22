// Single sensor row: name, value, status dot, trend arrow, limit bar, sparkline

import { memo } from 'react'
import { StatusDot } from '../common/StatusDot'
import { SensorSparkline } from '../charts/SensorSparkline'
import { useSensorHistory } from '../../hooks/useSensorHistory'
import { useSensorReading } from '../../store/selectors'
import { SENSOR_META } from '../../lib/constants'
import { formatSensorValue } from '../../lib/formatters'
import type { SensorId } from '../../types/sensors'

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

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#252840] hover:bg-[#252840] transition-colors">
      <StatusDot status={status} size="sm" />
      <span className="flex-1 text-xs text-slate-300 truncate">{label}</span>

      {!isOnOff && <TrendArrow trend={trend} status={status} />}

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
  )
})
