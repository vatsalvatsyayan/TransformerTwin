// Single FMEA failure mode card (collapsible) with visual evidence chain

import { memo, useState } from 'react'
import { StatusDot } from '../common/StatusDot'
import type { FMEAActiveMode, FMEAEvidence } from '../../types/fmea'

export interface FMEACardProps {
  mode: FMEAActiveMode
}

// ─── Evidence Chain ────────────────────────────────────────────────────────────
// Renders a causal flow: sensor conditions → threshold crossings → failure mode

function EvidenceChain({ evidence, matchScore }: { evidence: FMEAEvidence[]; matchScore: number }) {
  const matched = evidence.filter((e) => e.matched)
  const unmatched = evidence.filter((e) => !e.matched)

  return (
    <div className="space-y-1.5">
      {/* Matched evidence — rendered as a visual causal chain */}
      {matched.length > 0 && (
        <div>
          <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1 font-medium">Active Evidence Chain</p>
          <div className="relative pl-3 space-y-0">
            {/* Vertical connector line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-green-800/60" />

            {matched.map((e, i) => (
              <div key={i} className="relative flex items-start gap-2 py-1">
                {/* Node dot */}
                <div className="absolute left-0 top-[7px] w-2.5 h-2.5 rounded-full bg-green-900 border border-green-500 flex-shrink-0 z-10" />
                <div className="ml-4 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-green-300 leading-snug">{e.condition}</span>
                    {e.value && (
                      <span className="text-[9px] font-mono text-green-500 flex-shrink-0 bg-green-900/30 px-1.5 py-0.5 rounded">
                        {e.value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Arrow to failure mode */}
            <div className="relative flex items-center gap-2 pt-1">
              <div className="absolute left-0 top-[7px] w-2.5 h-2.5 flex items-center justify-center z-10">
                <svg className="w-2.5 h-2.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3l7 14H3L10 3z" />
                </svg>
              </div>
              <div className="ml-4 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-red-300">
                  → {matched.length}/{evidence.length} conditions met
                </span>
                <span className="text-[9px] font-mono text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">
                  {(matchScore * 100).toFixed(0)}% match
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unmatched evidence — dimmed checklist */}
      {unmatched.length > 0 && (
        <div>
          <p className="text-[9px] text-slate-700 uppercase tracking-wide mb-1 font-medium">Unmatched Conditions</p>
          <div className="space-y-0.5">
            {unmatched.map((e, i) => (
              <div key={i} className="flex items-start gap-2 py-0.5">
                <span className="text-slate-700 flex-shrink-0 mt-0.5">○</span>
                <span className="text-[10px] text-slate-600 leading-snug">{e.condition}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Score bar ─────────────────────────────────────────────────────────────────

function MatchScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    score >= 0.7 ? 'bg-red-500' :
    score >= 0.4 ? 'bg-orange-500' :
    'bg-yellow-500'
  return (
    <div className="h-0.5 bg-[#252840] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export const FMEACard = memo(function FMEACard({ mode }: FMEACardProps) {
  const [expanded, setExpanded] = useState(false)

  const scoreColor =
    mode.match_score >= 0.7 ? 'text-red-400' :
    mode.match_score >= 0.4 ? 'text-orange-400' :
    'text-yellow-400'

  const confidenceBg =
    mode.confidence_label === 'Probable'
      ? 'bg-red-900/60 text-red-300'
      : mode.confidence_label === 'Possible'
        ? 'bg-orange-900/50 text-orange-300'
        : 'bg-slate-800 text-slate-400'

  return (
    <div className="card mb-2 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#2d3148] transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={`text-xs font-mono font-bold ${scoreColor} w-8 flex-shrink-0`}>
          {(mode.match_score * 100).toFixed(0)}%
        </span>
        <StatusDot
          status={
            mode.confidence_label === 'Probable' ? 'CRITICAL' :
            mode.confidence_label === 'Possible' ? 'WARNING' : 'CAUTION'
          }
          size="sm"
        />
        <span className="flex-1 text-xs text-slate-200 font-medium truncate">{mode.name}</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${confidenceBg}`}>
          {mode.confidence_label}
        </span>
        <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">{mode.id}</span>
        <svg
          className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Score bar always visible under header */}
      <MatchScoreBar score={mode.match_score} />

      {expanded && (
        <div className="border-t border-[#2d3148] px-3 py-3 space-y-3 text-xs bg-[#13162280]">

          {/* Evidence chain */}
          <EvidenceChain evidence={mode.evidence} matchScore={mode.match_score} />

          {/* Affected components */}
          {mode.affected_components.length > 0 && (
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1 font-medium">Affected Components</p>
              <div className="flex flex-wrap gap-1">
                {mode.affected_components.map((c) => (
                  <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 text-[10px] text-slate-600 border-t border-[#2d3148] pt-2">
            <span>Severity: <span className="text-slate-400 font-mono">{mode.severity}</span></span>
            <span>·</span>
            <span>Development: <span className="text-slate-400">{mode.development_time}</span></span>
          </div>

          {/* Recommended actions */}
          {mode.recommended_actions.length > 0 && (
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-1 font-medium">Recommended Actions</p>
              <div className="space-y-1">
                {mode.recommended_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 flex-shrink-0 mt-0.5">→</span>
                    <span className="text-[10px] text-slate-400 leading-snug">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
