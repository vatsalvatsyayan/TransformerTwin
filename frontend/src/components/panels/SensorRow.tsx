// Single sensor row: name, value, status dot, sparkline

import { memo } from 'react'
import { StatusDot } from '../common/StatusDot'
import { SensorSparkline } from '../charts/SensorSparkline'
import { useSensorHistory } from '../../hooks/useSensorHistory'
import { SENSOR_META } from '../../lib/constants'
import { formatSensorValue } from '../../lib/formatters'
import type { SensorId } from '../../types/sensors'

export interface SensorRowProps {
  sensorId: SensorId
}

export const SensorRow = memo(function SensorRow({ sensorId }: SensorRowProps) {
  const { latestValue } = useSensorHistory(sensorId)
  const meta = SENSOR_META[sensorId]
  const label = meta?.label ?? sensorId
  const unit = meta?.unit ?? ''

  // Determine status from value vs thresholds (simplified; real status comes from WS)
  // For skeleton: always NORMAL
  const status = 'NORMAL'

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#252840] hover:bg-[#252840] transition-colors">
      <StatusDot status={status} size="sm" />
      <span className="flex-1 text-xs text-slate-300 truncate">{label}</span>
      <span className="text-xs font-mono text-slate-200 w-20 text-right">
        {latestValue !== undefined ? formatSensorValue(latestValue, unit) : '—'}
      </span>
      <div className="w-20 flex-shrink-0">
        <SensorSparkline sensorId={sensorId} status={status} height={24} />
      </div>
    </div>
  )
})
