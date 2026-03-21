// WebSocket message type discriminators — Integration Contract Section 2.3

import type { Alert } from './alerts'
import type { HealthComponentStatus, HealthComponentKey } from './health'
import type { SensorGroup, SensorId, SensorReading } from './sensors'
import type { ScenarioId } from './scenario'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

// ---- Server → Client -------------------------------------------------------

export interface WSConnectionAck {
  type: 'connection_ack'
  timestamp: string
  sim_time: number
  speed_multiplier: number
  active_scenario: ScenarioId
}

export interface WSSensorUpdate {
  type: 'sensor_update'
  timestamp: string
  sim_time: number
  group: SensorGroup
  sensors: Partial<Record<SensorId, SensorReading>>
}

export interface WSHealthUpdate {
  type: 'health_update'
  timestamp: string
  sim_time: number
  overall_score: number
  previous_score: number
  components: Record<HealthComponentKey, HealthComponentStatus>
}

export interface WSAlertMessage {
  type: 'alert'
  alert: Alert
}

export interface WSScenarioUpdate {
  type: 'scenario_update'
  scenario_id: ScenarioId
  name: string
  stage: string
  progress_percent: number
  elapsed_sim_time: number
}

export interface WSPing {
  type: 'ping'
  timestamp: string
}

export interface WSError {
  type: 'error'
  code: string
  message: string
}

export type ServerMessage =
  | WSConnectionAck
  | WSSensorUpdate
  | WSHealthUpdate
  | WSAlertMessage
  | WSScenarioUpdate
  | WSPing
  | WSError

// ---- Client → Server -------------------------------------------------------

export interface WSPong {
  type: 'pong'
}

export interface WSSetSpeed {
  type: 'set_speed'
  speed_multiplier: number
}

export interface WSTriggerScenario {
  type: 'trigger_scenario'
  scenario_id: ScenarioId
}

export interface WSAcknowledgeAlert {
  type: 'acknowledge_alert'
  alert_id: number
}

export type ClientMessage =
  | WSPong
  | WSSetSpeed
  | WSTriggerScenario
  | WSAcknowledgeAlert
