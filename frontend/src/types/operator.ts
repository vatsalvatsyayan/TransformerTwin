// Operator action types — direct interventions on the live simulator

export type OperatorAction =
  | 'REDUCE_LOAD_70'
  | 'REDUCE_LOAD_40'
  | 'RESTORE_LOAD'
  | 'UPGRADE_COOLING_ONAF'
  | 'UPGRADE_COOLING_OFAF'
  | 'RESTORE_COOLING'
  | 'CLEAR_ALL'

export interface OperatorStatus {
  load_override_pct: number | null
  cooling_override: string | null
  active_overrides: boolean
  message: string
}
