// Tab switcher for right panel

import { memo, useState } from 'react'
import { SensorPanel } from './SensorPanel'
import { DGAPanel } from './DGAPanel'
import { FMEAPanel } from './FMEAPanel'
import { WhatIfPanel } from './WhatIfPanel'
import { AlertPanel } from './AlertPanel'
import { useActiveAlertCount } from '../../store/selectors'

const TABS = ['Sensors', 'DGA', 'FMEA', 'What-If', 'Alerts'] as const
type Tab = (typeof TABS)[number]

export const TabContainer = memo(function TabContainer() {
  const [activeTab, setActiveTab] = useState<Tab>('Sensors')
  const alertCount = useActiveAlertCount()

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#2d3148] flex-shrink-0 bg-[#1a1d27]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
            {tab === 'Alerts' && alertCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] bg-red-500 text-white rounded-full">
                {alertCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'Sensors'  && <SensorPanel />}
        {activeTab === 'DGA'      && <DGAPanel />}
        {activeTab === 'FMEA'     && <FMEAPanel />}
        {activeTab === 'What-If'  && <WhatIfPanel />}
        {activeTab === 'Alerts'   && <AlertPanel />}
      </div>
    </div>
  )
})
