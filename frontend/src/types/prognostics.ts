// Prognostics types — health trajectory prediction and thermal fatigue assessment

export type PrognosisTrend = 'RAPIDLY_DEGRADING' | 'DEGRADING' | 'STABLE' | 'IMPROVING'
export type PrognosisConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA'
export type PrognosisUrgency = 'EMERGENCY' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NOMINAL'

export interface ThermalFatigue {
  score: number        // 0.0–1.0 normalized
  pct: number          // 0–100 percentage
  label: string        // "Negligible" | "Low" | "Moderate" | "High" | "Severe"
  description: string  // human-readable explanation
}

export interface ProjectedHealth {
  '24h': number | null
  '48h': number | null
  '72h': number | null
}

export interface InterventionProjection extends ProjectedHealth {
  time_to_critical_sim_hrs: number | null
}

export interface PrognosticsResponse {
  degradation_rate_per_sim_hr: number      // health pts/sim-hr, positive = degrading
  trend: PrognosisTrend
  trend_label: string                       // human-readable trend
  confidence: PrognosisConfidence
  urgency: PrognosisUrgency
  current_health_score: number
  time_to_warning_sim_hrs: number | null    // null = not projected / already past
  time_to_critical_sim_hrs: number | null
  projected_no_action: ProjectedHealth
  projected_intervention_70pct_load: InterventionProjection
  thermal_fatigue: ThermalFatigue
  cascade_triggered: boolean
  history_points: number
}
