// Active scenario + progress slice

import type { ScenarioId } from '../../types/scenario'

export interface ScenarioSlice {
  activeScenario: ScenarioId
  scenarioName: string
  stage: string
  progressPercent: number
  elapsedSimTime: number
  startedAt: string | null

  updateScenario: (payload: {
    scenario_id: ScenarioId
    name: string
    stage: string
    progress_percent: number
    elapsed_sim_time: number
  }) => void
}

export const createScenarioSlice = (set: (fn: (s: ScenarioSlice) => void) => void): ScenarioSlice => ({
  activeScenario: 'normal',
  scenarioName: 'Normal Operation',
  stage: 'Normal operation',
  progressPercent: 0,
  elapsedSimTime: 0,
  startedAt: null,

  updateScenario(payload) {
    set((state) => {
      state.activeScenario = payload.scenario_id
      state.scenarioName = payload.name
      state.stage = payload.stage
      state.progressPercent = payload.progress_percent
      state.elapsedSimTime = payload.elapsed_sim_time
    })
  },
})
