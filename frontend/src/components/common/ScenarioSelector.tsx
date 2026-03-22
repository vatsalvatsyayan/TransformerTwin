// Dropdown to trigger fault scenarios

import { memo, useState, useEffect } from 'react'
import { useStore } from '../../store'
import { api } from '../../lib/api'
import type { ScenarioId } from '../../types/scenario'

const SCENARIO_OPTIONS: { id: ScenarioId; label: string }[] = [
  { id: 'normal', label: 'Normal Operation' },
  { id: 'hot_spot', label: 'Developing Hot Spot' },
  { id: 'arcing', label: 'Arcing Event' },
  { id: 'cooling_failure', label: 'Cooling Fan Failure' },
  { id: 'partial_discharge', label: 'Partial Discharge' },
  { id: 'paper_degradation', label: 'Paper Insulation Degradation' },
  { id: 'thermal_runaway', label: 'Thermal Runaway — Full Cascade' },
]

export const ScenarioSelector = memo(function ScenarioSelector() {
  const activeScenario = useStore((s) => s.activeScenario)
  // Optimistic local state: updates immediately on user selection so the
  // select doesn't snap back to the old value while waiting for WebSocket confirmation.
  const [localScenario, setLocalScenario] = useState<ScenarioId>(activeScenario)

  // Sync with authoritative store value when WebSocket confirms the change
  useEffect(() => {
    setLocalScenario(activeScenario)
  }, [activeScenario])

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const scenarioId = e.target.value as ScenarioId
    setLocalScenario(scenarioId) // immediate visual feedback
    try {
      await api.triggerScenario(scenarioId)
    } catch (err) {
      console.error('Failed to trigger scenario:', err)
      setLocalScenario(activeScenario) // revert on failure
    }
  }

  return (
    <select
      value={localScenario}
      onChange={(e) => void handleChange(e)}
      className="bg-[#252840] border border-[#3d4168] text-slate-300 text-xs rounded px-2 py-1 cursor-pointer"
    >
      {SCENARIO_OPTIONS.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  )
})
