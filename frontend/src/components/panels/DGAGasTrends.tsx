// 7 DGA gas time-series charts — skeleton

import { memo } from 'react'
import { SensorLineChart } from '../charts/SensorLineChart'
import type { SensorId } from '../../types/sensors'

const DGA_SENSORS: SensorId[] = [
  'DGA_H2', 'DGA_CH4', 'DGA_C2H6', 'DGA_C2H4', 'DGA_C2H2', 'DGA_CO', 'DGA_CO2',
]

const GAS_LABELS: Record<string, string> = {
  DGA_H2: 'Hydrogen (H₂)', DGA_CH4: 'Methane (CH₄)', DGA_C2H6: 'Ethane (C₂H₆)',
  DGA_C2H4: 'Ethylene (C₂H₄)', DGA_C2H2: 'Acetylene (C₂H₂)',
  DGA_CO: 'Carbon Monoxide (CO)', DGA_CO2: 'Carbon Dioxide (CO₂)',
}

export const DGAGasTrends = memo(function DGAGasTrends() {
  return (
    <div className="p-3 space-y-4">
      {DGA_SENSORS.map((sensorId) => (
        <div key={sensorId}>
          <p className="text-[10px] text-slate-500 mb-1">{GAS_LABELS[sensorId]}</p>
          <SensorLineChart sensorId={sensorId} height={120} />
        </div>
      ))}
    </div>
  )
})
