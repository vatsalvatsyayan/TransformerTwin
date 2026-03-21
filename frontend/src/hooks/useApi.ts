// REST API fetch wrappers

import { api } from '../lib/api'
import { useStore } from '../store'
import type { SensorId, SensorHistoryPoint } from '../types/sensors'

/** Fetches current sensor readings and stores them */
export async function fetchCurrentSensors(): Promise<void> {
  const data = await api.getSensorsCurrent()
  const store = useStore.getState()
  store.updateReadings('all', data.sensors, data.sim_time, data.timestamp)
}

/** Fetches sensor history for one sensor and stores it */
export async function fetchSensorHistory(
  sensorId: SensorId,
  from?: string,
  to?: string,
  limit?: number,
): Promise<void> {
  const data = await api.getSensorHistory(sensorId, from, to, limit)
  const store = useStore.getState()
  store.setHistoryFromApi(sensorId, data.readings as SensorHistoryPoint[])
}

/** Fetches current health score */
export async function fetchHealth(): Promise<void> {
  const data = await api.getHealth()
  const store = useStore.getState()
  store.updateHealth(
    data.overall_score,
    store.overallScore,
    Object.fromEntries(
      Object.entries(data.components).map(([k, v]) => [
        k,
        { status: v.status, contribution: v.contribution },
      ]),
    ),
    data.timestamp,
  )
}

/** Fetches and stores all alerts */
export async function fetchAlerts(): Promise<void> {
  const data = await api.getAlerts()
  const store = useStore.getState()
  store.setAlerts(data.alerts, data.total_count, data.active_count)
}

/** Fetches DGA analysis (Duval zone, TDCG, CO2/CO, gas rates) and stores it */
export async function fetchDGAAnalysis(): Promise<void> {
  const data = await api.getDGAAnalysis()
  const store = useStore.getState()
  store.setDGAAnalysis(data)
}

/** Fetches FMEA failure mode results and stores them */
export async function fetchFMEA(): Promise<void> {
  const data = await api.getFMEA()
  const store = useStore.getState()
  store.setFMEAResponse(data)
}
