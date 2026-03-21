// Active/acknowledged alerts slice

import type { Alert } from '../../types/alerts'

export interface AlertSlice {
  alerts: Alert[]
  activeCount: number
  totalCount: number

  addAlert: (alert: Alert) => void
  setAlerts: (alerts: Alert[], total: number, active: number) => void
  acknowledgeAlert: (alertId: number, acknowledgedAt: string) => void
}

export const createAlertSlice = (set: (fn: (s: AlertSlice) => void) => void): AlertSlice => ({
  alerts: [],
  activeCount: 0,
  totalCount: 0,

  addAlert(alert) {
    set((state) => {
      // Prepend (newest first), avoid duplicates
      if (!state.alerts.find((a) => a.id === alert.id)) {
        state.alerts = [alert, ...state.alerts]
        if (!alert.acknowledged) {
          state.activeCount += 1
          state.totalCount += 1
        }
      }
    })
  },

  setAlerts(alerts, total, active) {
    set((state) => {
      state.alerts = alerts
      state.totalCount = total
      state.activeCount = active
    })
  },

  acknowledgeAlert(alertId, acknowledgedAt) {
    set((state) => {
      const alert = state.alerts.find((a) => a.id === alertId)
      if (alert && !alert.acknowledged) {
        alert.acknowledged = true
        alert.acknowledged_at = acknowledgedAt
        state.activeCount = Math.max(0, state.activeCount - 1)
      }
    })
  },
})
