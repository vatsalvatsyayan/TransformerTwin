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
        <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
          <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span className="text-xs font-medium">System nominal</span>
          <span className="text-[10px] text-slate-600">No active alerts</span>
        </div>
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
