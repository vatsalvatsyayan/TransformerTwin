// FMEA failure mode results slice

import type { FMEAResponse } from '../../types/fmea'

export interface FMEASlice {
  response: FMEAResponse | null
  lastUpdated: string | null

  setFMEAResponse: (response: FMEAResponse) => void
}

export const createFMEASlice = (set: (fn: (s: FMEASlice) => void) => void): FMEASlice => ({
  response: null,
  lastUpdated: null,

  setFMEAResponse(response) {
    set((state) => {
      state.response = response
      state.lastUpdated = response.timestamp
    })
  },
})
