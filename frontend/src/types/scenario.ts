// Scenario types — Integration Contract Section 1.5 and 3.11–3.12

export type ScenarioId = 'normal' | 'hot_spot' | 'arcing' | 'cooling_failure' | 'partial_discharge' | 'paper_degradation'

export interface ScenarioTriggerResponse {
  scenario_id: ScenarioId
  name: string
  status: string
  description: string
  started_at: string
}

export interface ScenarioStatusResponse {
  active_scenario: ScenarioId
  name: string
  started_at: string
  elapsed_sim_time: number
  progress_percent: number
  stage: string
}
