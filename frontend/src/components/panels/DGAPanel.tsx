// DGA panel with sub-tabs: Gas Trends / Duval / Summary

import { memo, useState } from 'react'
import { DGAGasTrends } from './DGAGasTrends'
import { DuvalTriangle } from './DuvalTriangle'
import { DGASummary } from './DGASummary'

const SUB_TABS = ['Trends', 'Duval', 'Summary'] as const
type SubTab = (typeof SUB_TABS)[number]

export const DGAPanel = memo(function DGAPanel() {
  const [sub, setSub] = useState<SubTab>('Trends')

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-[#2d3148] flex-shrink-0">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={`px-3 py-2 text-[11px] font-medium transition-colors ${
              sub === t ? 'text-white border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {sub === 'Trends'  && <DGAGasTrends />}
        {sub === 'Duval'   && <DuvalTriangle />}
        {sub === 'Summary' && <DGASummary />}
      </div>
    </div>
  )
})
