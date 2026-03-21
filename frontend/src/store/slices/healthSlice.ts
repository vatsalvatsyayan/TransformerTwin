// Health score + component breakdown slice

import type { HealthComponentDetail, HealthComponentKey, HealthStatusLabel } from '../../types/health'

export interface HealthSlice {
  overallScore: number
  previousScore: number
  status: HealthStatusLabel
  components: Partial<Record<HealthComponentKey, HealthComponentDetail>>
  lastUpdated: string | null

  updateHealth: (
    score: number,
    previousScore: number,
    components: Record<string, { status: string; contribution: number }>,
    timestamp: string,
  ) => void
}

export const createHealthSlice = (set: (fn: (s: HealthSlice) => void) => void): HealthSlice => ({
  overallScore: 100,
  previousScore: 100,
  status: 'GOOD',
  components: {},
  lastUpdated: null,

  updateHealth(score, previousScore, components, timestamp) {
    set((state) => {
      state.overallScore = score
      state.previousScore = previousScore
      state.lastUpdated = timestamp
      state.status =
        score >= 80 ? 'GOOD' : score >= 60 ? 'FAIR' : score >= 40 ? 'POOR' : 'CRITICAL'
      // Map WS compact form to HealthComponentDetail (weight/penalty populated from REST)
      for (const [key, comp] of Object.entries(components)) {
        const existing = state.components[key as HealthComponentKey]
        state.components[key as HealthComponentKey] = {
          status: comp.status as HealthComponentDetail['status'],
          penalty: existing?.penalty ?? 0,
          weight: existing?.weight ?? 0,
          contribution: comp.contribution,
        }
      }
    })
  },
})
