// DGA Summary tab: TDCG, CO2/CO, generation rates — skeleton

import { memo } from 'react'
import { useStore } from '../../store'

export const DGASummary = memo(function DGASummary() {
  const analysis = useStore((s) => s.analysis)

  if (!analysis) {
    return <div className="p-4 text-xs text-slate-500">No DGA data yet.</div>
  }

  const { tdcg, co2_co_ratio, gas_rates } = analysis

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="card p-3 space-y-1">
        <span className="text-slate-400 font-medium">TDCG</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold font-mono text-white">{tdcg.value}</span>
          <span className="text-slate-500">{tdcg.unit}</span>
          <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium ${
            tdcg.status === 'NORMAL' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>{tdcg.status}</span>
        </div>
      </div>

      <div className="card p-3">
        <span className="text-slate-400 font-medium">CO₂/CO Ratio</span>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-white">{co2_co_ratio.value.toFixed(1)}</span>
          <span className="text-slate-500 text-[10px]">{co2_co_ratio.interpretation}</span>
        </div>
      </div>

      <div className="card p-3">
        <span className="text-slate-400 font-medium block mb-2">Generation Rates</span>
        {Object.entries(gas_rates).map(([gas, rate]) => (
          <div key={gas} className="flex items-center justify-between py-0.5">
            <span className="text-slate-400">{gas.replace('DGA_', '')}</span>
            <span className="font-mono text-slate-200">{rate.rate_ppm_per_day.toFixed(1)} ppm/day</span>
            <span className={`text-[10px] ${
              rate.trend === 'RISING' ? 'text-red-400' :
              rate.trend === 'FALLING' ? 'text-green-400' : 'text-slate-500'
            }`}>{rate.trend}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
