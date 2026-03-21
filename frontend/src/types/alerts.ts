// Alert types — Integration Contract Section 1.3 and 2.3.1

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type AlertSource = 'ANOMALY_ENGINE' | 'FMEA_ENGINE' | 'THRESHOLD'

export interface Alert {
  id: number
  timestamp: string
  severity: AlertSeverity
  title: string
  description: string
  source: AlertSource
  sensor_ids: string[]
  failure_mode_id: string | null
  recommended_actions: string[]
  acknowledged: boolean
  acknowledged_at: string | null
  sim_time: number
}

export interface AlertsListResponse {
  alerts: Alert[]
  total_count: number
  active_count: number
}
