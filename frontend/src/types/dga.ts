// DGA analysis types — Integration Contract Section 3.6

import type { SensorStatus } from './sensors'

export type DuvalZone = 'PD' | 'T1' | 'T2' | 'T3' | 'D1' | 'D2' | 'DT' | 'NONE'

export type GasRateTrend = 'RISING' | 'STABLE' | 'FALLING'

export interface DuvalPoint {
  x: number  // pct_ch4 / 100
  y: number  // pct_c2h4 / 100
  z: number  // pct_c2h2 / 100
}

export interface DuvalResult {
  pct_ch4: number
  pct_c2h4: number
  pct_c2h2: number
  zone: DuvalZone
  zone_label: string
  point: DuvalPoint
}

export interface TDCGStatus {
  value: number
  unit: string
  status: SensorStatus
}

export interface CO2CORatio {
  value: number
  interpretation: string
}

export interface GasRate {
  rate_ppm_per_day: number
  trend: GasRateTrend
}

export interface DGAAnalysisResponse {
  timestamp: string
  duval: DuvalResult
  tdcg: TDCGStatus
  co2_co_ratio: CO2CORatio
  gas_rates: Record<string, GasRate>  // keyed by DGA SensorId
}
