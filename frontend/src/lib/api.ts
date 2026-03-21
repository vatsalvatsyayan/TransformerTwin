// Fetch wrappers for all REST endpoints

import type { AlertsListResponse } from '../types/alerts'
import type { DGAAnalysisResponse } from '../types/dga'
import type { FMEAResponse } from '../types/fmea'
import type { HealthResponse, HealthHistoryPoint } from '../types/health'
import type { ScenarioStatusResponse, ScenarioTriggerResponse } from '../types/scenario'
import type { SimulationRequest, SimulationResponse } from '../types/simulation'
import type { DecisionResponse } from '../types/decision'
import type { SensorId } from '../types/sensors'

const BASE_URL = 'http://localhost:8001'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getTransformer: () => request<Record<string, unknown>>('/api/transformer'),

  getSensorsCurrent: () =>
    request<{ timestamp: string; sim_time: number; sensors: Record<string, unknown> }>(
      '/api/sensors/current',
    ),

  getSensorHistory: (
    sensorId: SensorId,
    from?: string,
    to?: string,
    limit?: number,
  ) => {
    const params = new URLSearchParams({ sensor_id: sensorId })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (limit !== undefined) params.set('limit', String(limit))
    return request<{ sensor_id: string; unit: string; readings: unknown[] }>(
      `/api/sensors/history?${params}`,
    )
  },

  getHealth: () => request<HealthResponse>('/api/health'),

  getHealthHistory: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return request<{ scores: HealthHistoryPoint[] }>(`/api/health/history?${params}`)
  },

  getDGAAnalysis: () => request<DGAAnalysisResponse>('/api/dga/analysis'),

  getFMEA: () => request<FMEAResponse>('/api/fmea'),

  getAlerts: (status = 'all', limit = 50) =>
    request<AlertsListResponse>(`/api/alerts?status=${status}&limit=${limit}`),

  acknowledgeAlert: (alertId: number) =>
    request<{ id: number; acknowledged: boolean; acknowledged_at: string }>(
      `/api/alerts/${alertId}/acknowledge`,
      { method: 'PUT' },
    ),

  runSimulation: (body: SimulationRequest) =>
    request<SimulationResponse>('/api/simulation', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  triggerScenario: (scenarioId: string) =>
    request<ScenarioTriggerResponse>(`/api/scenario/${scenarioId}/trigger`, { method: 'POST' }),

  getScenarioStatus: () => request<ScenarioStatusResponse>('/api/scenario/status'),

  setSpeed: (multiplier: number) =>
    request<unknown>('/api/simulation/speed', {
      method: 'PUT',
      body: JSON.stringify({ speed_multiplier: multiplier }),
    }),

  /** Return all sensor readings closest to (at or before) the given sim_time. */
  getDecision: () => request<DecisionResponse>('/api/decision'),

  /** Return all sensor readings closest to (at or before) the given sim_time. */
  getSensorsSnapshot: (simTime: number) =>
    request<{ timestamp: string; sim_time: number; sensors: Record<string, unknown> }>(
      `/api/sensors/snapshot?sim_time=${simTime}`,
    ),
}
