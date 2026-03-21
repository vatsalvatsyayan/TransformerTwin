// Sensor readings + history ring buffers slice

import type { SensorId, SensorReadings, SensorHistoryPoint } from '../../types/sensors'

/** Maximum history points kept per sensor in the in-memory ring buffer */
export const SENSOR_HISTORY_BUFFER_SIZE = 720  // 1 hour of thermal data at 5s intervals

export interface SensorSlice {
  /** Latest readings for all sensors */
  readings: Partial<SensorReadings>
  /** Rolling history buffer per sensor (newest last) */
  history: Partial<Record<SensorId, SensorHistoryPoint[]>>
  /** Simulation time of last update */
  lastSimTime: number

  updateReadings: (
    group: string,
    sensors: Partial<SensorReadings>,
    simTime: number,
    timestamp: string,
  ) => void
  setHistoryFromApi: (sensorId: SensorId, points: SensorHistoryPoint[]) => void
}

export const createSensorSlice = (set: (fn: (s: SensorSlice) => void) => void): SensorSlice => ({
  readings: {},
  history: {},
  lastSimTime: 0,

  updateReadings(_group, sensors, simTime, timestamp) {
    set((state) => {
      state.readings = { ...state.readings, ...sensors }
      state.lastSimTime = simTime

      // Append to history ring buffers
      for (const [sensorId, reading] of Object.entries(sensors)) {
        const id = sensorId as SensorId
        const buf = state.history[id] ?? []
        const point: SensorHistoryPoint = { timestamp, value: reading.value, sim_time: simTime }
        const next = buf.length >= SENSOR_HISTORY_BUFFER_SIZE ? buf.slice(1) : buf
        state.history[id] = [...next, point]
      }
    })
  },

  setHistoryFromApi(sensorId, points) {
    set((state) => {
      state.history[sensorId] = points.slice(-SENSOR_HISTORY_BUFFER_SIZE)
    })
  },
})
