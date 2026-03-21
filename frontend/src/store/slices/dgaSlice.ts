// DGA analysis results + Duval state slice

import type { DGAAnalysisResponse } from '../../types/dga'

export interface DGASlice {
  analysis: DGAAnalysisResponse | null
  lastUpdated: string | null

  setDGAAnalysis: (analysis: DGAAnalysisResponse) => void
}

export const createDGASlice = (set: (fn: (s: DGASlice) => void) => void): DGASlice => ({
  analysis: null,
  lastUpdated: null,

  setDGAAnalysis(analysis) {
    set((state) => {
      state.analysis = analysis
      state.lastUpdated = analysis.timestamp
    })
  },
})
