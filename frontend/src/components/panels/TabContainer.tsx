// Tab switcher for right panel — 8 tabs including Timeline and Physics
// Physics tab now has two sub-views: Correlation Chart + Operating Envelope

import { memo, useState } from 'react'
import { SensorPanel } from './SensorPanel'
import { DGAPanel } from './DGAPanel'
import { FMEAPanel } from './FMEAPanel'
import { WhatIfPanel } from './WhatIfPanel'
import { AlertPanel } from './AlertPanel'
import { DecisionPanel } from './DecisionPanel'
import { EventTimeline } from './EventTimeline'
import { CorrelationChart } from '../charts/CorrelationChart'
import { OperatingEnvelopeChart } from '../charts/OperatingEnvelopeChart'
import { useActiveAlertCount } from '../../store/selectors'
import { useStore } from '../../store'
import { HealthGauge } from '../health/HealthGauge'
import { HealthBreakdown } from '../health/HealthBreakdown'
import { ScenarioProgressBar } from '../common/ScenarioProgressBar'

const TABS = ['Sensors', 'DGA', 'FMEA', 'Decision', 'What-If', 'Alerts', 'Timeline', 'Physics'] as const
type Tab = (typeof TABS)[number]

type PhysicsSubTab = 'Correlation' | 'Envelope'

// ─── Physics tab — sub-tab switcher ──────────────────────────────────────────

function PhysicsTabContent() {
  const [subTab, setSubTab] = useState<PhysicsSubTab>('Envelope')

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex border-b border-[#2d3148] bg-[#1a1d27] flex-shrink-0">
        {(['Envelope', 'Correlation'] as PhysicsSubTab[]).map((st) => (
          <button
            key={st}
            onClick={() => setSubTab(st)}
            className={`px-4 py-2 text-[10px] font-medium transition-colors flex-shrink-0 ${
              subTab === st
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {st === 'Envelope' ? '◇ Operating Envelope' : '∿ Temporal Correlation'}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center pr-3 text-[9px] text-slate-700">
          IEC 60076-7 thermal model
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {subTab === 'Envelope'     && <OperatingEnvelopeChart />}
        {subTab === 'Correlation'  && <CorrelationChart />}
      </div>
    </div>
  )
}

// ─── Main TabContainer ────────────────────────────────────────────────────────

export const TabContainer = memo(function TabContainer() {
  const [activeTab, setActiveTab] = useState<Tab>('Sensors')
  const alertCount    = useActiveAlertCount()
  const decisionRisk  = useStore((s) => s.decision?.risk_level)
  const timelineCount = useStore((s) => s.timelineEvents.length)

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — scrollable so all 8 tabs fit on narrow screens */}
      <div className="flex border-b border-[#2d3148] flex-shrink-0 bg-[#1a1d27] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2.5 text-xs font-medium transition-colors relative flex-shrink-0 ${
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
            {tab === 'Decision' && decisionRisk && decisionRisk !== 'NOMINAL' && decisionRisk !== 'LOW' && (
              <span className={`ml-1 inline-flex items-center justify-center w-2 h-2 rounded-full ${
                decisionRisk === 'CRITICAL' || decisionRisk === 'HIGH' ? 'bg-orange-500' : 'bg-yellow-500'
              }`} />
            )}
            {tab === 'Timeline' && timelineCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 text-[9px] bg-slate-700 text-slate-300 rounded-full">
                {timelineCount > 99 ? '99+' : timelineCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Health gauge + component breakdown — always visible above tab content */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[#2d3148] bg-[#161927] flex-shrink-0">
        <HealthGauge size={64} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Health Components</p>
          <HealthBreakdown />
        </div>
      </div>

      {/* Scenario progress — shown only during active fault simulations */}
      <ScenarioProgressBar />

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'Sensors'   && <SensorPanel />}
        {activeTab === 'DGA'       && <DGAPanel />}
        {activeTab === 'FMEA'      && <FMEAPanel />}
        {activeTab === 'Decision'  && <DecisionPanel />}
        {activeTab === 'What-If'   && <WhatIfPanel />}
        {activeTab === 'Alerts'    && <AlertPanel />}
        {activeTab === 'Timeline'  && <EventTimeline />}
        {activeTab === 'Physics'   && <PhysicsTabContent />}
      </div>
    </div>
  )
})
