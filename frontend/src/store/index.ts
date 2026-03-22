// Zustand store — flat store (no immer, no slice pattern complexity for skeleton)

import { create } from 'zustand'
import type { SensorId, SensorReadings, SensorHistoryPoint } from '../types/sensors'
import type { Alert } from '../types/alerts'
import type { HealthComponentDetail, HealthComponentKey, HealthStatusLabel } from '../types/health'
import type { DGAAnalysisResponse, DuvalResult } from '../types/dga'
import type { FMEAResponse } from '../types/fmea'
import type { ScenarioId } from '../types/scenario'
import type { ConnectionState } from '../types/websocket'
import type { DecisionResponse } from '../types/decision'
import type { OperatorStatus } from '../types/operator'
import type { PrognosticsResponse } from '../types/prognostics'

/** Maximum history points kept per sensor in the in-memory ring buffer */
export const SENSOR_HISTORY_BUFFER_SIZE = 720

export type PlaybackMode = 'live' | 'playback'

export interface AppState {
  // --- Sensors ---
  readings: Partial<SensorReadings>
  history: Partial<Record<SensorId, SensorHistoryPoint[]>>
  lastSimTime: number

  // --- Health ---
  overallScore: number
  previousScore: number
  status: HealthStatusLabel
  components: Partial<Record<HealthComponentKey, HealthComponentDetail>>

  // --- Alerts ---
  alerts: Alert[]
  activeCount: number
  totalCount: number

  // --- DGA ---
  analysis: DGAAnalysisResponse | null
  duvalHistory: DuvalResult[]

  // --- FMEA ---
  response: FMEAResponse | null

  // --- Scenario ---
  activeScenario: ScenarioId
  scenarioName: string
  stage: string
  progressPercent: number
  elapsedSimTime: number
  // Cascade: thermal→arcing escalation state (from scenario_update WS message)
  cascadeTriggered: boolean
  thermalFatigueScore: number

  // --- Connection ---
  connectionStatus: ConnectionState
  speedMultiplier: number
  simTime: number
  wallClockTime: string | null

  // --- Decision ---
  decision: DecisionResponse | null

  // --- Operator controls ---
  operatorStatus: OperatorStatus | null

  // --- Prognostics ---
  prognostics: PrognosticsResponse | null

  // --- Health component selection (drives 3D highlight) ---
  selectedHealthComponent: HealthComponentKey | null

  // --- Playback ---
  mode: PlaybackMode
  playbackPosition: string | null
  isPlaying: boolean

  // --- Actions ---
  updateReadings: (
    group: string,
    sensors: Partial<SensorReadings>,
    simTime: number,
    timestamp: string,
  ) => void
  setHistoryFromApi: (sensorId: SensorId, points: SensorHistoryPoint[]) => void
  updateHealth: (
    score: number,
    prevScore: number,
    components: Record<string, { status: string; contribution: number }>,
    timestamp: string,
  ) => void
  addAlert: (alert: Alert) => void
  setAlerts: (alerts: Alert[], total: number, active: number) => void
  acknowledgeAlert: (alertId: number, acknowledgedAt: string) => void
  setDGAAnalysis: (analysis: DGAAnalysisResponse) => void
  setFMEAResponse: (response: FMEAResponse) => void
  updateScenario: (payload: {
    scenario_id: ScenarioId
    name: string
    stage: string
    progress_percent: number
    elapsed_sim_time: number
    cascade_triggered?: boolean
    thermal_fatigue_score?: number
  }) => void
  setConnectionStatus: (status: ConnectionState) => void
  setSpeedMultiplier: (speed: number) => void
  setSimTime: (simTime: number, wallClock: string) => void
  enterPlayback: (position: string) => void
  exitPlayback: () => void
  setPlaybackPosition: (position: string) => void
  setIsPlaying: (playing: boolean) => void
  setDecision: (decision: DecisionResponse) => void
  setOperatorStatus: (status: OperatorStatus) => void
  setSelectedHealthComponent: (key: HealthComponentKey | null) => void
  setPrognostics: (prog: PrognosticsResponse) => void
}

export const useStore = create<AppState>()((set) => ({
  // Initial state
  readings: {},
  history: {},
  lastSimTime: 0,
  overallScore: 100,
  previousScore: 100,
  status: 'GOOD',
  components: {},
  alerts: [],
  activeCount: 0,
  totalCount: 0,
  analysis: null,
  duvalHistory: [],
  response: null,
  activeScenario: 'normal',
  scenarioName: 'Normal Operation',
  stage: 'Normal operation',
  progressPercent: 0,
  elapsedSimTime: 0,
  cascadeTriggered: false,
  thermalFatigueScore: 0,
  connectionStatus: 'disconnected',
  speedMultiplier: 1,
  simTime: 0,
  wallClockTime: null,
  decision: null,
  operatorStatus: null,
  prognostics: null,
  selectedHealthComponent: null,
  mode: 'live',
  playbackPosition: null,
  isPlaying: false,

  // Actions
  updateReadings(_group, sensors, simTime, timestamp) {
    set((state) => {
      const newHistory = { ...state.history }
      for (const [id, reading] of Object.entries(sensors)) {
        const sensorId = id as SensorId
        const buf = newHistory[sensorId] ?? []
        const point: SensorHistoryPoint = { timestamp, value: reading.value, sim_time: simTime }
        const trimmed = buf.length >= SENSOR_HISTORY_BUFFER_SIZE ? buf.slice(1) : buf
        newHistory[sensorId] = [...trimmed, point]
      }
      return { readings: { ...state.readings, ...sensors }, history: newHistory, lastSimTime: simTime }
    })
  },

  setHistoryFromApi(sensorId, points) {
    set((state) => ({
      history: { ...state.history, [sensorId]: points.slice(-SENSOR_HISTORY_BUFFER_SIZE) },
    }))
  },

  updateHealth(score, prevScore, components, _timestamp) {
    set((state) => {
      const updated: Partial<Record<HealthComponentKey, HealthComponentDetail>> = { ...state.components }
      for (const [key, comp] of Object.entries(components)) {
        const k = key as HealthComponentKey
        updated[k] = {
          status: comp.status as HealthComponentDetail['status'],
          penalty: state.components[k]?.penalty ?? 0,
          weight: state.components[k]?.weight ?? 0,
          contribution: comp.contribution,
        }
      }
      const newStatus: HealthStatusLabel =
        score >= 80 ? 'GOOD' : score >= 60 ? 'FAIR' : score >= 40 ? 'POOR' : 'CRITICAL'
      return { overallScore: score, previousScore: prevScore, status: newStatus, components: updated }
    })
  },

  addAlert(alert) {
    set((state) => {
      if (state.alerts.find((a) => a.id === alert.id)) return {}
      return {
        alerts: [alert, ...state.alerts],
        activeCount: state.activeCount + (alert.acknowledged ? 0 : 1),
        totalCount: state.totalCount + 1,
      }
    })
  },

  setAlerts: (alerts, total, active) => set({ alerts, totalCount: total, activeCount: active }),

  acknowledgeAlert(alertId, acknowledgedAt) {
    set((state) => {
      const target = state.alerts.find((a) => a.id === alertId && !a.acknowledged)
      return {
        alerts: state.alerts.map((a) =>
          a.id === alertId ? { ...a, acknowledged: true, acknowledged_at: acknowledgedAt } : a,
        ),
        activeCount: target ? Math.max(0, state.activeCount - 1) : state.activeCount,
      }
    })
  },

  setDGAAnalysis: (analysis) =>
    set((state) => {
      if (!analysis.duval || analysis.duval.zone === 'NONE') return { analysis }
      const trail = [...state.duvalHistory, analysis.duval].slice(-20)
      return { analysis, duvalHistory: trail }
    }),
  setFMEAResponse: (response) => set({ response }),

  updateScenario: (p) =>
    set({
      activeScenario: p.scenario_id,
      scenarioName: p.name,
      stage: p.stage,
      progressPercent: p.progress_percent,
      elapsedSimTime: p.elapsed_sim_time,
      cascadeTriggered: p.cascade_triggered ?? false,
      thermalFatigueScore: p.thermal_fatigue_score ?? 0,
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSpeedMultiplier: (speed) => set({ speedMultiplier: speed }),
  setSimTime: (simTime, wallClock) => set({ simTime, wallClockTime: wallClock }),
  enterPlayback: (position) => set({ mode: 'playback', playbackPosition: position, isPlaying: false }),
  exitPlayback: () => set({ mode: 'live', playbackPosition: null, isPlaying: false }),
  setPlaybackPosition: (position) => set({ playbackPosition: position }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setDecision: (decision) => set({ decision }),
  setOperatorStatus: (status) => set({ operatorStatus: status }),
  setSelectedHealthComponent: (key) => set({ selectedHealthComponent: key }),
  setPrognostics: (prog) => set({ prognostics: prog }),
}))
