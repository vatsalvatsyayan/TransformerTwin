// Health score types — Integration Contract Sections 1.10 and 3.4

import type { SensorStatus } from './sensors'

export type HealthStatusLabel = 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL'

export type HealthComponentKey =
  | 'dga'
  | 'winding_temp'
  | 'oil_temp'
  | 'cooling'
  | 'oil_quality'
  | 'bushing'

export interface HealthComponentDetail {
  status: SensorStatus
  penalty: number
  weight: number
  contribution: number
}

export interface HealthResponse {
  timestamp: string
  overall_score: number
  status: HealthStatusLabel
  components: Record<HealthComponentKey, HealthComponentDetail>
}

/** Lightweight version in WS health_update message */
export interface HealthComponentStatus {
  status: SensorStatus
  contribution: number
}

export interface HealthHistoryPoint {
  timestamp: string
  overall_score: number
  sim_time: number
}
