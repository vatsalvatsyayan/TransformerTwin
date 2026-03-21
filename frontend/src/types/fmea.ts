// FMEA types — Integration Contract Section 3.7

export type FailureModeId =
  | 'FM-001' | 'FM-002' | 'FM-003' | 'FM-004'
  | 'FM-005' | 'FM-006' | 'FM-007' | 'FM-008'

export type FMEAConfidence = 'Monitoring' | 'Possible' | 'Probable'

export interface FMEAEvidence {
  condition: string
  matched: boolean
  value: string
}

export interface FMEAActiveMode {
  id: string  // FailureModeId
  name: string
  match_score: number
  confidence_label: FMEAConfidence
  severity: number
  affected_components: string[]
  evidence: FMEAEvidence[]
  recommended_actions: string[]
  development_time: string
}

export interface FMEAResponse {
  timestamp: string
  active_modes: FMEAActiveMode[]
}
