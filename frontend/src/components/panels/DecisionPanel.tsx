// Decision Support Panel — prescriptive analytics: risk, economics, runbooks

import { memo, useState } from 'react'
import { useStore } from '../../store'
import type { RiskLevel, OperatorRunbook, EconomicImpact } from '../../types/decision'

// ─── helpers ────────────────────────────────────────────────────────────────

function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'text-red-400'
    case 'HIGH':     return 'text-orange-400'
    case 'MEDIUM':   return 'text-yellow-400'
    case 'LOW':      return 'text-blue-400'
    default:         return 'text-green-400'
  }
}

function riskBg(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-900/30 border-red-700'
    case 'HIGH':     return 'bg-orange-900/30 border-orange-700'
    case 'MEDIUM':   return 'bg-yellow-900/20 border-yellow-700'
    case 'LOW':      return 'bg-blue-900/20 border-blue-700'
    default:         return 'bg-green-900/20 border-green-800'
  }
}

function riskDots(level: RiskLevel): number {
  switch (level) {
    case 'CRITICAL': return 5
    case 'HIGH':     return 4
    case 'MEDIUM':   return 3
    case 'LOW':      return 2
    default:         return 1
  }
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toLocaleString()}`
}

// ─── sub-components ─────────────────────────────────────────────────────────

function RiskBadge({ level, score, description }: { level: RiskLevel; score: number; description: string }) {
  const dots = riskDots(level)
  return (
    <div className={`rounded-lg border p-3 ${riskBg(level)}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map((i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i <= dots ? riskColor(level).replace('text-', 'bg-') : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <span className={`text-sm font-bold ${riskColor(level)}`}>{level}</span>
        </div>
        <span className="text-xs text-slate-500 font-mono">{Math.round(score * 100)}% risk index</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function EconomicTable({ impact }: { impact: EconomicImpact }) {
  const rows = [
    {
      scenario: impact.act_now,
      icon: '✓',
      iconColor: 'text-green-400',
      rowBg: 'bg-green-900/10',
      badge: 'RECOMMENDED',
      badgeColor: 'bg-green-900 text-green-300',
    },
    {
      scenario: impact.act_later,
      icon: '⚠',
      iconColor: 'text-yellow-400',
      rowBg: '',
      badge: `${Math.round(impact.act_later.fault_escalation_probability * 100)}% escalation risk`,
      badgeColor: 'bg-yellow-900/50 text-yellow-300',
    },
    {
      scenario: impact.no_action,
      icon: '✗',
      iconColor: 'text-red-400',
      rowBg: 'bg-red-900/10',
      badge: 'FAILURE SCENARIO',
      badgeColor: 'bg-red-900/50 text-red-300',
    },
  ]

  return (
    <div className="space-y-2">
      {rows.map(({ scenario, icon, iconColor, rowBg, badge, badgeColor }) => (
        <div key={scenario.label} className={`rounded-lg border border-[#2d3148] p-2.5 ${rowBg}`}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold ${iconColor}`}>{icon}</span>
              <span className="text-xs font-medium text-slate-300">{scenario.label}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${badgeColor}`}>{badge}</span>
              <span className="text-sm font-bold text-white font-mono">{formatUSD(scenario.total)}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">{scenario.description}</p>
        </div>
      ))}

      <div className="flex items-center justify-between px-2.5 py-2 bg-[#1a2535] rounded-lg border border-blue-900/50">
        <span className="text-xs text-slate-400">Potential savings by acting now:</span>
        <span className="text-sm font-bold text-blue-300 font-mono">{formatUSD(impact.potential_savings_usd)}</span>
      </div>
    </div>
  )
}

function RunbookCard({ runbook }: { runbook: OperatorRunbook }) {
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const completedCount = checked.size
  const totalCount = runbook.steps.length
  const progressPct = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="rounded-lg border border-[#2d3148] bg-[#181b2e] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-2 p-3 text-left hover:bg-[#1e2238] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold text-slate-200">{runbook.title}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              runbook.confidence_label === 'Probable'
                ? 'bg-red-900/60 text-red-300'
                : 'bg-orange-900/50 text-orange-300'
            }`}>
              {runbook.confidence_label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span>{runbook.failure_mode_id}</span>
            <span>·</span>
            <span className="font-mono">{runbook.procedure_id}</span>
            <span>·</span>
            <span>Act within {runbook.urgency_hours}h</span>
            {completedCount > 0 && (
              <>
                <span>·</span>
                <span className="text-green-400">{completedCount}/{totalCount} steps done</span>
              </>
            )}
          </div>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Progress bar */}
      {completedCount > 0 && (
        <div className="h-0.5 bg-[#252840]">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Steps */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-[#2d3148] pt-2.5">
          {runbook.steps.map((step, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="w-full flex items-start gap-2.5 text-left group"
            >
              <div className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition-colors ${
                checked.has(i)
                  ? 'bg-green-600 border-green-500'
                  : 'border-slate-600 group-hover:border-slate-400'
              }`}>
                {checked.has(i) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-[11px] leading-relaxed ${checked.has(i) ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                <span className="text-slate-600 mr-1">{i + 1}.</span>
                {step}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ─────────────────────────────────────────────────────────────

export const DecisionPanel = memo(function DecisionPanel() {
  const decision = useStore((s) => s.decision)

  if (!decision) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
        <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-xs font-medium">Loading decision analysis…</span>
      </div>
    )
  }

  const { risk_level, risk_score, risk_description, time_to_action_hours,
    economic_impact, decision_recommendation, active_runbooks } = decision

  return (
    <div className="p-3 space-y-4 text-xs">

      {/* ── Risk Assessment ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Asset Risk Assessment</h3>
          {time_to_action_hours != null && (
            <span className="text-[10px] font-mono text-orange-400">
              Action threshold in ~{time_to_action_hours}h
            </span>
          )}
        </div>
        <RiskBadge level={risk_level} score={risk_score} description={risk_description} />
      </section>

      {/* ── Decision Recommendation ── */}
      <section>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Recommended Action</h3>
        <div className={`rounded-lg border p-3 ${riskBg(risk_level)}`}>
          <div className="flex items-start gap-2">
            <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${riskColor(risk_level)}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-slate-200 mb-1">{decision_recommendation.action}</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">{decision_recommendation.reasoning}</p>
              {decision_recommendation.deadline_hours != null && (
                <p className="text-[10px] text-orange-400 mt-1 font-medium">
                  Deadline: within {decision_recommendation.deadline_hours} hours
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Economic Impact ── */}
      {economic_impact?.act_now && (
        <section>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Economic Impact Analysis</h3>
          <EconomicTable impact={economic_impact} />
        </section>
      )}

      {/* ── Operator Runbooks ── */}
      {active_runbooks.length > 0 && (
        <section>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Operator Runbooks ({active_runbooks.length} active)
          </h3>
          <div className="space-y-2">
            {active_runbooks.map((rb) => (
              <RunbookCard key={rb.failure_mode_id} runbook={rb} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state when system is nominal */}
      {active_runbooks.length === 0 && risk_level === 'NOMINAL' && (
        <div className="flex flex-col items-center gap-2 py-6 text-slate-600">
          <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span className="text-xs font-medium">All systems nominal</span>
          <span className="text-[10px] text-slate-700">No operator actions required</span>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[9px] text-slate-700 text-center border-t border-[#2d3148] pt-3">
        Economic estimates based on industry averages. Consult asset manager before operational changes.
      </p>
    </div>
  )
})
