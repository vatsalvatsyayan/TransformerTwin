// Tiny inline sparkline chart (60 points, no axes)

import { memo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { useSensorHistory } from '../../hooks/useSensorHistory'
import { STATUS_COLORS } from '../../lib/constants'
import type { SensorId } from '../../types/sensors'

export interface SensorSparklineProps {
  sensorId: SensorId
  status?: string
  height?: number
}

export const SensorSparkline = memo(function SensorSparkline({
  sensorId,
  status = 'NORMAL',
  height = 28,
}: SensorSparklineProps) {
  const { points } = useSensorHistory(sensorId)
  const data = points.slice(-60)

  if (data.length < 2) {
    return <div style={{ height }} className="w-full" />
  }

  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.NORMAL

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
})
