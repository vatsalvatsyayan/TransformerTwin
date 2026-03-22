// Live Prognosis Widget — health trajectory prediction + thermal fatigue
// Displays: degradation rate, time-to-failure, projected health, fatigue

import { memo } from 'react'
import { useStore } from '../../store'
import type { PrognosticsResponse, PrognosisTrend, PrognosisUrgency } from '../../types/prognostics'

// ─── helpers ─────────────────────────────────────────────────────────────────

function trendColor(trend: PrognosisTrend): string {
  switch (trend) {
    case 'RAPIDLY_DEGRADING': return 'text-red-400'
    case 'DEGRADING': return 'text-orange-400'
    case 'IMPROVING': return 'text-green-400'
    default: return 'text-slate-400'
  }
}

function urgencyBg(urgency: PrognosisUrgency): string {
  switch (urgency) {
    case 'EMERGENCY':
    case 'CRITICAL':   return 'bg-red-900/30 border-red-700'
    case 'HIGH':       return 'bg-orange-900/25 border-orange-700'
    case 'MEDIUM':     return 'bg-yellow-900/20 border-yellow-700'
    default:           return 'bg-[#1a1d27] border-[#2d3148]'
  }
}

function formatHours(hrs: number | null): string {
  if (hrs === null) return '—'
  if (hrs < 1) return `${Math.round(hrs * 60)} min`
  if (hrs < 24) return `${hrs.toFixed(1)} hrs`
  return `${(hrs / 24).toFixed(1)} days`
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-slate-500'
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

// ─── Projected Health Mini-Chart ─────────────────────────────────────────────

function ProjectionBars({ prog }: { prog: PrognosticsResponse }) {
  const { projected_no_action: noAction, projected_intervention_70pct_load: intervention } = prog
  const horizons = ['24h', '48h', '72h'] as const

  return (
    <div>
      <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-2 font-medium">
        Projected Health Score
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {horizons.map((h) => {
          const noActionScore = noAction[h]
          const interventionScore = intervention[h]
          return (
            <div key={h} className="rounded bg-[#1a1d27] border border-[#2d3148] p-2">
              <p className="text-[9px] text-slate-600 text-center mb-2 font-medium">+{h}</p>
              {/* No action */}
              <div className="mb-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] text-slate-600">No action</span>
                  <span className={`text-[9px] font-mono font-bold ${scoreColor(noActionScore)}`}>
                    {noActionScore !== null ? noActionScore.toFixed(0) : '?'}
                  </span>
                </div>
                <div className="h-1 bg-[#2d3148] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${noActionScore ?? 0}%`,
                      backgroundColor: noActionScore !== null && noActionScore < 40
                        ? '#ef4444' : noActionScore !== null && noActionScore < 60
                        ? '#f97316' : '#eab308',
                    }}
                  />
                </div>
              </div>
              {/* With intervention */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] text-emerald-600">70% load</span>
                  <span className={`text-[9px] font-mono font-bold ${scoreColor(interventionScore)}`}>
                    {interventionScore !== null ? interventionScore.toFixed(0) : '?'}
                  </span>
                </div>
                <div className="h-1 bg-[#2d3148] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${interventionScore ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Thermal Fatigue Bar ──────────────────────────────────────────────────────

function ThermalFatigueBar({ prog }: { prog: PrognosticsResponse }) {
  const { thermal_fatigue: fatigue } = prog
  const pct = fatigue.pct

  const barColor =
    pct < 20 ? 'bg-green-500' :
    pct < 50 ? 'bg-yellow-500' :
    pct < 80 ? 'bg-orange-500' :
    'bg-red-500'

  return (
    <div className="rounded-lg border border-[#2d3148] bg-[#1a1d27] p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-400">Cumulative Thermal Fatigue</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            pct < 20 ? 'bg-green-900/40 text-green-300' :
            pct < 50 ? 'bg-yellow-900/40 text-yellow-300' :
            pct < 80 ? 'bg-orange-900/40 text-orange-300' :
            'bg-red-900/40 text-red-300'
          }`}>{fatigue.label}</span>
          <span className="text-[10px] font-mono text-slate-400">{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#2d3148] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <p className="text-[9px] text-slate-600 leading-relaxed mt-1.5">{fatigue.description}</p>
    </div>
  )
}

// ─── Time-to-Event Countdown ─────────────────────────────────────────────────

function TimeToEventRow({
  label,
  hours,
  color,
}: {
  label: string
  hours: number | null
  color: string
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-mono font-bold ${hours === null ? 'text-slate-600' : color}`}>
        {hours === null ? 'Not projected' : formatHours(hours)}
      </span>
    </div>
  )
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export const PrognosticsWidget = memo(function PrognosticsWidget() {
  const prog = useStore((s) => s.prognostics)

  if (!prog) {
    return (
      <div className="rounded-lg border border-[#2d3148] bg-[#1a1d27] px-3 py-4 text-center">
        <p className="text-[10px] text-slate-600">Loading prognosis…</p>
      </div>
    )
  }

  const isInsufficient = prog.confidence === 'INSUFFICIENT_DATA'
  const isDegrading = ['DEGRADING', 'RAPIDLY_DEGRADING'].includes(prog.trend)

  return (
    <div className={`rounded-lg border overflow-hidden ${urgencyBg(prog.urgency)}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2d3148]">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Live Prognosis</span>
        </div>
        <div className="flex items-center gap-2">
          {!isInsufficient && (
            <span className="text-[9px] text-slate-600 font-mono">
              {prog.history_points} pts / conf: {prog.confidence}
            </span>
          )}
          <span className={`text-[9px] font-bold uppercase tracking-wide ${trendColor(prog.trend)}`}>
            {prog.trend_label}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Degradation rate + time to events */}
        {!isInsufficient && (
          <div className="rounded-lg border border-[#2d3148] bg-[#161927] px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-slate-600 uppercase tracking-wide font-medium">Degradation Rate</span>
              <span className={`text-sm font-mono font-bold ${
                prog.degradation_rate_per_sim_hr > 3 ? 'text-red-400' :
                prog.degradation_rate_per_sim_hr > 0.5 ? 'text-orange-400' :
                prog.degradation_rate_per_sim_hr < -0.5 ? 'text-green-400' :
                'text-slate-400'
              }`}>
                {prog.degradation_rate_per_sim_hr > 0 ? '-' : prog.degradation_rate_per_sim_hr < -0.05 ? '+' : '±'}
                {Math.abs(prog.degradation_rate_per_sim_hr).toFixed(2)} pts/sim-hr
              </span>
            </div>
            <div className="border-t border-[#2d3148] pt-2 divide-y divide-[#2d3148]">
              <TimeToEventRow
                label="Time to WARNING (score < 60)"
                hours={prog.time_to_warning_sim_hrs}
                color="text-yellow-400"
              />
              <TimeToEventRow
                label="Time to CRITICAL (score < 40)"
                hours={prog.time_to_critical_sim_hrs}
                color="text-red-400"
              />
              {prog.projected_intervention_70pct_load.time_to_critical_sim_hrs !== null && (
                <TimeToEventRow
                  label="Time to CRITICAL with 70% load"
                  hours={prog.projected_intervention_70pct_load.time_to_critical_sim_hrs}
                  color="text-emerald-400"
                />
              )}
            </div>
          </div>
        )}

        {/* Insufficient data message */}
        {isInsufficient && !prog.cascade_triggered && (
          <div className="text-center py-2">
            <p className="text-[10px] text-slate-600">Accumulating history for trajectory projection…</p>
            <p className="text-[9px] text-slate-700 mt-1">
              Prognosis available after {prog.history_points < 8 ? `${8 - prog.history_points} more` : 'a few more'} readings
            </p>
          </div>
        )}

        {/* Projected health bars — only show when degrading and data sufficient */}
        {isDegrading && !isInsufficient && (
          <ProjectionBars prog={prog} />
        )}

        {/* Thermal fatigue — always show */}
        <ThermalFatigueBar prog={prog} />
      </div>
    </div>
  )
})
