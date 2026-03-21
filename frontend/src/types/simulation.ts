// What-if simulation types — Integration Contract Section 3.10

export type CoolingMode = 'ONAN' | 'ONAF' | 'OFAF'

export interface SimulationRequest {
  load_percent: number         // 0.0–150.0
  ambient_temp_c: number       // -10.0–50.0
  cooling_mode: CoolingMode
  time_horizon_days: number    // 1–30
}

export interface ProjectionDay {
  day: number
  hotspot_temp_c: number
  top_oil_temp_c: number
  aging_factor: number
}

export interface SimulationResponse {
  projected_hotspot_temp_c: number
  projected_top_oil_temp_c: number
  aging_acceleration_factor: number
  aging_interpretation: string
  estimated_days_to_warning: number | null
  cooling_energy_impact_percent: number
  cooling_energy_interpretation: string
  projection_timeline: ProjectionDay[]
}
