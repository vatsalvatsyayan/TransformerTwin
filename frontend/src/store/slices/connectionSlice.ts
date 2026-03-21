// WebSocket connection state and simulation speed slice

import type { ConnectionState } from '../../types/websocket'

export interface ConnectionSlice {
  status: ConnectionState
  speedMultiplier: number
  simTime: number
  wallClockTime: string | null

  setConnectionStatus: (status: ConnectionState) => void
  setSpeedMultiplier: (speed: number) => void
  setSimTime: (simTime: number, wallClock: string) => void
}

export const createConnectionSlice = (
  set: (fn: (s: ConnectionSlice) => void) => void,
): ConnectionSlice => ({
  status: 'disconnected',
  speedMultiplier: 1,
  simTime: 0,
  wallClockTime: null,

  setConnectionStatus(status) {
    set((state) => {
      state.status = status
    })
  },

  setSpeedMultiplier(speed) {
    set((state) => {
      state.speedMultiplier = speed
    })
  },

  setSimTime(simTime, wallClock) {
    set((state) => {
      state.simTime = simTime
      state.wallClockTime = wallClock
    })
  },
})
