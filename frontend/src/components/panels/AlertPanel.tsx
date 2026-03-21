// Alert feed list panel — expandable cards with descriptions and recommended actions

import { memo, useState } from 'react'
import { useStore } from '../../store'
import { StatusDot } from '../common/StatusDot'
import { formatTimestamp } from '../../lib/formatters'
import { api } from '../../lib/api'
import type { Alert } from '../../types/alerts'

function getLeftBorderClass(alert: Alert): string {
  if (alert.source !== 'FMEA_ENGINE') return ''
  return alert.severity === 'CRITICAL' ? 'border-l-2 border-red-500' : 'border-l-2 border-orange-400'
}

export const AlertPanel = memo(function AlertPanel() {
  const alerts = useStore((s) => s.alerts)
  const acknowledgeAlert = useStore((s) => s.acknowledgeAlert)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const handleAck = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await api.acknowledgeAlert(alertId)
      acknowledgeAlert(alertId, res.acknowledged_at)
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  const toggleExpand = (alertId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(alertId)) {
        next.delete(alertId)
      } else {
        next.add(alertId)
      }
      return next
    })
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
        alerts.map((alert) => {
          const isExpanded = expandedIds.has(alert.id)
          const isFmea = alert.source === 'FMEA_ENGINE'
          const hasDetails = !!(alert.description || (alert.recommended_actions && alert.recommended_actions.length > 0))
          return (
            <div
              key={alert.id}
              onClick={() => hasDetails && toggleExpand(alert.id)}
              className={`card px-3 py-2 text-xs ${alert.acknowledged ? 'opacity-50' : ''} ${hasDetails ? 'cursor-pointer hover:bg-[#2a2e48]' : ''} ${getLeftBorderClass(alert)} transition-colors`}
            >
              {/* Header row */}
              <div className="flex items-start gap-2">
                <StatusDot
                  status={alert.severity === 'CRITICAL' ? 'CRITICAL' : alert.severity === 'WARNING' ? 'WARNING' : 'CAUTION'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-slate-200">{alert.title}</span>
                    {isFmea && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-purple-900 text-purple-300 font-semibold uppercase tracking-wide">
                        FMEA
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{formatTimestamp(alert.timestamp)}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!alert.acknowledged && (
                    <button
                      onClick={(e) => void handleAck(alert.id, e)}
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      Ack
                    </button>
                  )}
                  {hasDetails && (
                    <svg
                      className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && hasDetails && (
                <div className="mt-2 pt-2 border-t border-[#2d3148] space-y-2">
                  {alert.description && (
                    <p className="text-[10px] text-slate-400 leading-relaxed">{alert.description}</p>
                  )}
                  {alert.recommended_actions && alert.recommended_actions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-300 mb-1">Recommended Actions:</p>
                      <ul className="space-y-0.5">
                        {alert.recommended_actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                            <span className="text-blue-400 flex-shrink-0 mt-0.5">→</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
})
