// Live readings + sparklines for all 21 sensors

import { memo } from 'react'
import { SensorRow } from './SensorRow'
import { ALL_SENSOR_IDS } from '../../types/sensors'

export const SensorPanel = memo(function SensorPanel() {
  return (
    <div className="py-1">
      <div className="flex items-center px-3 py-1.5 border-b border-[#2d3148] text-[10px] text-slate-500 uppercase tracking-wide">
        <span className="flex-1">Sensor</span>
        <span className="w-20 text-right mr-20">Value</span>
      </div>
      {ALL_SENSOR_IDS.map((sensorId) => (
        <SensorRow key={sensorId} sensorId={sensorId} />
      ))}
    </div>
  )
})
