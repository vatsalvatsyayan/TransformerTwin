// Event Timeline — chronological operational narrative of the transformer session
// Captures alerts, health drops, scenario changes, and cascade events.

import { memo } from 'react'
import { useStore } from '../../store'
import type { TimelineEvent, TimelineEventType, TimelineSeverity } from '../../types/timeline'
import { formatSimTime } from '../../lib/formatters'

// ─── Severity styling ────────────────────────────────────────────────────────

function severityBorder(sev: TimelineSeverity): string {
  switch (sev) {
    case 'critical': return 'border-l-red-500'
    case 'warning':  return 'border-l-orange-500'
    case 'caution':  return 'border-l-yellow-500'
    default:         return 'border-l-blue-500'
  }
}

function severityBg(sev: TimelineSeverity): string {
  switch (sev) {
    case 'critical': return 'bg-red-950/30'
    case 'warning':  return 'bg-orange-950/30'
    case 'caution':  return 'bg-yellow-950/20'
    default:         return 'bg-blue-950/20'
  }
}

function severityDot(sev: TimelineSeverity): string {
  switch (sev) {
    case 'critical': return 'bg-red-500'
    case 'warning':  return 'bg-orange-500'
    case 'caution':  return 'bg-yellow-500'
    default:         return 'bg-blue-400'
  }
}

function severityLabel(sev: TimelineSeverity): string {
  switch (sev) {
    case 'critical': return 'CRITICAL'
    case 'warning':  return 'WARNING'
    case 'caution':  return 'CAUTION'
    default:         return 'INFO'
  }
}

function severityLabelColor(sev: TimelineSeverity): string {
  switch (sev) {
    case 'critical': return 'text-red-400'
    case 'warning':  return 'text-orange-400'
    case 'caution':  return 'text-yellow-400'
    default:         return 'text-blue-400'
  }
}

// ─── Event type icon & label ─────────────────────────────────────────────────

function eventTypeIcon(type: TimelineEventType): string {
  switch (type) {
    case 'alert':       return '⚡'
    case 'health_drop': return '📉'
    case 'scenario':    return '▶'
    case 'cascade':     return '🔴'
    case 'operator':    return '🎛'
    case 'connection':  return '🔗'
    default:            return '○'
  }
}

// ─── EventRow ────────────────────────────────────────────────────────────────

const EventRow = memo(function EventRow({ event }: { event: TimelineEvent }) {
  const wallDt = new Date(event.wallTime)
  const wallStr = wallDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className={`border-l-2 pl-3 pr-3 py-2 ${severityBorder(event.severity)} ${severityBg(event.severity)}`}>
      <div className="flex items-center gap-2 mb-0.5">
        {/* Severity dot */}
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityDot(event.severity)}`} />

        {/* Severity badge */}
        <span className={`text-[9px] font-bold tracking-widest flex-shrink-0 ${severityLabelColor(event.severity)}`}>
          {severityLabel(event.severity)}
        </span>

        {/* Event type icon */}
        <span className="text-[10px] flex-shrink-0">{eventTypeIcon(event.type)}</span>

        {/* Title */}
        <span className="text-[11px] font-medium text-slate-200 flex-1 truncate">{event.title}</span>

        {/* Timestamp */}
        <span className="text-[9px] text-slate-600 flex-shrink-0 font-mono">{wallStr}</span>
      </div>

      {/* Detail + sim time */}
      <div className="flex items-baseline gap-2 pl-3.5">
        <p className="text-[10px] text-slate-400 leading-relaxed flex-1">{event.detail}</p>
        {event.simTime > 0 && (
          <span className="text-[9px] text-slate-700 font-mono flex-shrink-0">
            T+{formatSimTime(event.simTime)}
          </span>
        )}
      </div>
    </div>
  )
})

// ─── EventTimeline ────────────────────────────────────────────────────────────

export const EventTimeline = memo(function EventTimeline() {
  const events = useStore((s) => s.timelineEvents)

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-slate-600">
        <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium">No events yet</span>
        <span className="text-xs text-center leading-relaxed max-w-[200px]">
          Events appear here as the transformer is monitored — alerts, health changes, and scenario progressions.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[#252840] bg-[#161927] flex-shrink-0">
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">Operational Log</span>
        <div className="flex items-center gap-2 ml-auto">
          {(['critical','warning','caution','info'] as TimelineSeverity[]).map((sev) => (
            <div key={sev} className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${severityDot(sev)}`} />
              <span className={`text-[8px] ${severityLabelColor(sev)}`}>{sev.toUpperCase()}</span>
            </div>
          ))}
        </div>
        <span className="text-[9px] text-slate-700">{events.length} events</span>
      </div>

      {/* Event list — most recent first */}
      <div className="divide-y divide-[#252840]">
        {events.map((ev) => (
          <EventRow key={ev.id} event={ev} />
        ))}
      </div>
    </div>
  )
})
