// Live alert toast — transient overlay for CRITICAL/WARNING alerts over the 3D viewer

import { memo, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import type { Alert } from '../../types/alerts'

const TOAST_DURATION_MS = 5000

export const AlertToast = memo(function AlertToast() {
  const alerts = useStore((s) => s.alerts)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const prevLengthRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visible, setVisible] = useState(false)
  const [toastAlert, setToastAlert] = useState<Alert | null>(null)

  useEffect(() => {
    if (alerts.length > prevLengthRef.current) {
      // Newest alert is always first in the list
      const newest = alerts[0]
      if (newest && (newest.severity === 'CRITICAL' || newest.severity === 'WARNING')) {
        // Clear any existing timer before showing new toast
        if (timerRef.current) clearTimeout(timerRef.current)
        setToastAlert(newest)
        setVisible(true)
        timerRef.current = setTimeout(() => setVisible(false), TOAST_DURATION_MS)
      }
    }
    prevLengthRef.current = alerts.length
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [alerts])

  if (!visible || !toastAlert) return null

  const isCritical = toastAlert.severity === 'CRITICAL'
  const isFmea = toastAlert.source === 'FMEA_ENGINE'
  const firstAction = toastAlert.recommended_actions?.[0]

  const handleClick = () => {
    setActiveTab('Alerts')
    setVisible(false)
  }

  return (
    <div
      onClick={handleClick}
      className={`absolute top-3 right-3 z-50 max-w-[280px] rounded-lg shadow-xl border text-xs cursor-pointer
        ${isCritical
          ? 'bg-red-950/95 border-red-700 text-red-100 hover:border-red-500'
          : 'bg-orange-950/95 border-orange-700 text-orange-100 hover:border-orange-500'
        }`}
      style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
    >
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
            ${isCritical ? 'bg-red-700 text-red-100' : 'bg-orange-700 text-orange-100'}`}>
            {toastAlert.severity}
          </span>
          {isFmea && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-purple-800 text-purple-200">
              FMEA
            </span>
          )}
        </div>

        {/* Title */}
        <div className="font-semibold text-white leading-snug">{toastAlert.title}</div>

        {/* First recommended action if available */}
        {firstAction && (
          <div className={`mt-1.5 text-[10px] ${isCritical ? 'text-red-300' : 'text-orange-300'}`}>
            → {firstAction}
          </div>
        )}

        {/* Click-to-navigate hint */}
        <div className={`mt-2 pt-1.5 border-t text-[10px] flex items-center gap-1 ${
          isCritical ? 'border-red-800/60 text-red-400' : 'border-orange-800/60 text-orange-400'
        }`}>
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          View in Alerts tab
        </div>
      </div>
    </div>
  )
})
