// Decision support types — prescriptive analytics layer

export type RiskLevel = 'NOMINAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface EconomicScenario {
  label: string
  total: number
  description: string
}

export interface ActNowScenario extends EconomicScenario {
  maintenance_cost: number
  production_loss: number
}

export interface ActLaterScenario extends EconomicScenario {
  fault_escalation_probability: number
  repair_cost: number
  downtime_hours: number
  downtime_cost: number
}

export interface NoActionScenario extends EconomicScenario {
  replacement_cost: number
  outage_days: number
  outage_cost: number
}

export interface EconomicImpact {
  currency: string
  act_now: ActNowScenario
  act_later: ActLaterScenario
  no_action: NoActionScenario
  potential_savings_usd: number
}

export interface DecisionRecommendation {
  action: string
  reasoning: string
  deadline_hours: number | null
}

export interface OperatorRunbook {
  failure_mode_id: string
  title: string
  procedure_id: string
  urgency_hours: number
  steps: string[]
  confidence_label: string
  match_score: number
}

export interface ActiveFailureMode {
  id: string
  name: string
  confidence_label: string
  match_score: number
}

export interface DecisionResponse {
  timestamp: string
  risk_level: RiskLevel
  risk_score: number
  risk_description: string
  time_to_action_hours: number | null
  confidence_pct: number
  economic_impact: EconomicImpact
  decision_recommendation: DecisionRecommendation
  active_runbooks: OperatorRunbook[]
  active_failure_modes: ActiveFailureMode[]
}
