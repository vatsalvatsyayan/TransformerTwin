// Full time-series chart with threshold bands — placeholder skeleton

import { memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useSensorHistory } from '../../hooks/useSensorHistory'
import { SENSOR_META, STATUS_COLORS } from '../../lib/constants'
import { formatTimestamp } from '../../lib/formatters'
import type { SensorId } from '../../types/sensors'

export interface SensorLineChartProps {
  sensorId: SensorId
  height?: number
}

export const SensorLineChart = memo(function SensorLineChart({
  sensorId,
  height = 200,
}: SensorLineChartProps) {
  const { points } = useSensorHistory(sensorId)
  const meta = SENSOR_META[sensorId]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTimestamp}
          tick={{ fontSize: 10, fill: '#64748b' }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{ background: '#1e2133', border: '1px solid #3d4168', borderRadius: 6 }}
          labelStyle={{ color: '#94a3b8', fontSize: 10 }}
          itemStyle={{ color: '#e2e8f0', fontSize: 11 }}
          labelFormatter={formatTimestamp}
        />
        {meta && (
          <>
            <ReferenceLine y={meta.caution}  stroke={STATUS_COLORS.CAUTION}  strokeDasharray="4 2" strokeWidth={1} />
            <ReferenceLine y={meta.warning}  stroke={STATUS_COLORS.WARNING}  strokeDasharray="4 2" strokeWidth={1} />
            <ReferenceLine y={meta.critical} stroke={STATUS_COLORS.CRITICAL} strokeDasharray="4 2" strokeWidth={1} />
          </>
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
})
