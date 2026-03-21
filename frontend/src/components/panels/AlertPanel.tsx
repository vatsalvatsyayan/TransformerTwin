// Alert feed list panel

import { memo } from 'react'
import { useStore } from '../../store'
import { StatusDot } from '../common/StatusDot'
import { formatTimestamp } from '../../lib/formatters'
import { api } from '../../lib/api'

export const AlertPanel = memo(function AlertPanel() {
  const alerts = useStore((s) => s.alerts)
  const acknowledgeAlert = useStore((s) => s.acknowledgeAlert)

  const handleAck = async (alertId: number) => {
    try {
      const res = await api.acknowledgeAlert(alertId)
      acknowledgeAlert(alertId, res.acknowledged_at)
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  return (
    <div className="p-2 space-y-1.5">
      {alerts.length === 0 ? (
        <div className="text-xs text-slate-500 text-center py-8">No alerts.</div>
      ) : (
        alerts.map((alert) => (
          <div
            key={alert.id}
            className={`card px-3 py-2 text-xs ${alert.acknowledged ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start gap-2">
              <StatusDot
                status={alert.severity === 'CRITICAL' ? 'CRITICAL' : alert.severity === 'WARNING' ? 'WARNING' : 'CAUTION'}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-200">{alert.title}</div>
                <div className="text-slate-500 text-[10px] mt-0.5">{formatTimestamp(alert.timestamp)}</div>
              </div>
              {!alert.acknowledged && (
                <button
                  onClick={() => void handleAck(alert.id)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 flex-shrink-0"
                >
                  Ack
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
})
