// Hook for accessing the rolling history buffer for chart data

import { useSensorHistory as _useSensorHistory } from '../store/selectors'
import type { SensorId, SensorHistoryPoint } from '../types/sensors'

export interface UseSensorHistoryResult {
  points: SensorHistoryPoint[]
  latestValue: number | undefined
}

/** Returns the rolling history buffer for a sensor, ready for Recharts. */
export function useSensorHistory(sensorId: SensorId): UseSensorHistoryResult {
  const points = _useSensorHistory(sensorId)
  const latestValue = points.length > 0 ? points[points.length - 1].value : undefined

  return { points, latestValue }
}
