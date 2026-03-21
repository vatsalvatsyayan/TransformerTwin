// Sparkline of health score over time — skeleton

import { memo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

export interface HealthTrendProps {
  data: Array<{ overall_score: number; timestamp: string }>
  height?: number
}

export const HealthTrend = memo(function HealthTrend({ data, height = 40 }: HealthTrendProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="overall_score"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
})
