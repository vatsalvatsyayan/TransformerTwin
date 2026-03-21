// What-if timeline projection chart — skeleton

import { memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ProjectionDay } from '../../types/simulation'

export interface ProjectionChartProps {
  data: ProjectionDay[]
  height?: number
}

export const ProjectionChart = memo(function ProjectionChart({
  data,
  height = 200,
}: ProjectionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} label={{ value: 'Days', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} width={40} />
        <Tooltip contentStyle={{ background: '#1e2133', border: '1px solid #3d4168', borderRadius: 6 }} itemStyle={{ fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="hotspot_temp_c" name="Hot Spot (°C)" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="top_oil_temp_c" name="Top Oil (°C)" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
})
