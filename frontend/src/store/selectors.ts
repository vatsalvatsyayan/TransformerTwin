// Memoized selectors for derived state

import { useStore } from './index'
import type { SensorId } from '../types/sensors'

/** Returns the latest reading for a specific sensor */
export function useSensorReading(sensorId: SensorId) {
  return useStore((s) => s.readings[sensorId])
}

/** Returns the history buffer for a specific sensor */
export function useSensorHistory(sensorId: SensorId) {
  return useStore((s) => s.history[sensorId] ?? [])
}

/** Returns count of active (unacknowledged) alerts */
export function useActiveAlertCount() {
  return useStore((s) => s.activeCount)
}

/** Returns current overall health score */
export function useHealthScore() {
  return useStore((s) => s.overallScore)
}

/** Returns connection status */
export function useConnectionStatus() {
  return useStore((s) => s.connectionStatus)
}

/** Returns active scenario info */
export function useActiveScenario() {
  return useStore((s) => ({
    id: s.activeScenario,
    name: s.scenarioName,
    stage: s.stage,
    progress: s.progressPercent,
  }))
}
