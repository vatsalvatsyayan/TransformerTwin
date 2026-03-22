// Asset identity strip + real-time KPI tiles
// Answers "what am I monitoring and is it OK?" in under 5 seconds

import { memo } from 'react'
import { useStore } from '../../store'
import type { PrognosisTrend } from '../../types/prognostics'

// ─── KPI Tile ───────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string
  value: string
  sub: string
  color: string
  pct?: number // 0–1, optional fill bar
}

const KpiTile = memo(function KpiTile({ label, value, sub, color, pct }: KpiTileProps) {
  return (
    <div className="flex flex-col justify-center px-3 py-2 rounded border border-[#2d3148] bg-[#161927] min-w-[120px]">
      <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-tight mb-0.5">{label}</span>
      <span className={`text-[15px] font-bold font-mono leading-tight ${color}`}>{value}</span>
      {pct !== undefined && (
        <div className="mt-1 h-1 bg-[#252840] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pct > 0.9 ? 'bg-red-500' : pct > 0.75 ? 'bg-orange-500' : pct > 0.55 ? 'bg-yellow-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, pct * 100).toFixed(1)}%` }}
          />
        </div>
      )}
      <span className="text-[10px] text-slate-600 leading-tight mt-0.5">{sub}</span>
    </div>
  )
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trendColor(trend: PrognosisTrend | undefined): string {
  switch (trend) {
    case 'RAPIDLY_DEGRADING': return 'text-red-400'
    case 'DEGRADING':         return 'text-orange-400'
    case 'IMPROVING':         return 'text-emerald-400'
    default:                  return 'text-sky-400'
  }
}

function rulText(hrs: number | null | undefined): string {
  if (hrs == null) return '12+ yr'
  if (hrs < 1) return '<1 sim-hr'
  if (hrs < 48) return `${Math.round(hrs)} sim-hr`
  return `${Math.round(hrs / 24)} sim-days`
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AssetKPIBar = memo(function AssetKPIBar() {
  const readings  = useStore((s) => s.readings)
  const score     = useStore((s) => s.overallScore)
  const status    = useStore((s) => s.status)
  const prog      = useStore((s) => s.prognostics)

  const loadFactor  = readings['LOAD_CURRENT']?.value   // percent 0–130+
  const topOilTemp  = readings['TOP_OIL_TEMP']?.value   // °C
  const windingTemp = readings['WINDING_TEMP']?.value   // °C

  // IEC 60076-7: winding hot-spot limit = 140°C for class A insulation
  const windingPct  = windingTemp != null ? windingTemp / 140 : undefined
  // Typical top-oil limit at rated load: ~95°C rise
  const topOilPct   = topOilTemp  != null ? topOilTemp  / 95  : undefined
  const loadPct     = loadFactor  != null ? loadFactor  / 100 : undefined

  const healthPct = score / 100
  const rulStr    = rulText(prog?.time_to_critical_sim_hrs)

  const windingColor =
    windingTemp == null        ? 'text-slate-500'
    : windingTemp > 120        ? 'text-red-400'
    : windingTemp > 105        ? 'text-orange-400'
    : windingTemp > 90         ? 'text-yellow-400'
    : 'text-emerald-400'

  const topOilColor =
    topOilTemp == null         ? 'text-slate-500'
    : topOilTemp > 85          ? 'text-red-400'
    : topOilTemp > 75          ? 'text-orange-400'
    : topOilTemp > 65          ? 'text-yellow-400'
    : 'text-emerald-400'

  const loadColor =
    loadFactor == null         ? 'text-slate-500'
    : loadFactor > 100         ? 'text-red-400'
    : loadFactor > 90          ? 'text-orange-400'
    : loadFactor > 75          ? 'text-yellow-400'
    : 'text-emerald-400'

  const healthColor =
    status === 'GOOD'          ? 'text-emerald-400'
    : status === 'FAIR'        ? 'text-yellow-400'
    : status === 'POOR'        ? 'text-orange-400'
    : 'text-red-400'

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-[#0f111a] border-b border-[#2d3148] flex-shrink-0 overflow-x-auto">

      {/* ── Transformer Nameplate ────────────────────────────────── */}
      <div className="flex-shrink-0 border-r border-[#2d3148] pr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white font-mono">TRF-001</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-bold font-mono uppercase tracking-wide">100 MVA</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">230 / 69 kV</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">ONAN/ONAF/OFAF</span>
        </div>
        <div className="text-[10px] text-slate-500 leading-tight">
          GE Vernova · Substation Alpha, Bay 3 · S/N: GEV-2005-0847 · In service since 2005
        </div>
      </div>

      {/* ── KPI Tiles ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <KpiTile
          label="Load Factor"
          value={loadFactor != null ? `${loadFactor.toFixed(1)} %` : '— %'}
          sub={
            loadFactor == null  ? 'Waiting…'
            : loadFactor > 100  ? 'Overloaded ⚠'
            : loadFactor > 80   ? 'Heavy load'
            : loadFactor > 50   ? 'Normal load'
            : 'Light load'
          }
          color={loadColor}
          pct={loadPct}
        />

        <KpiTile
          label="Winding Temp"
          value={windingTemp != null ? `${windingTemp.toFixed(1)} °C` : '— °C'}
          sub={windingTemp != null ? `${Math.round((windingTemp / 140) * 100)} % of 140 °C limit` : 'Waiting…'}
          color={windingColor}
          pct={windingPct}
        />

        <KpiTile
          label="Top Oil Temp"
          value={topOilTemp != null ? `${topOilTemp.toFixed(1)} °C` : '— °C'}
          sub={topOilTemp != null ? `${Math.round((topOilTemp / 95) * 100)} % of 95 °C limit` : 'Waiting…'}
          color={topOilColor}
          pct={topOilPct}
        />

        <KpiTile
          label="Health Index"
          value={`${Math.round(score)} / 100`}
          sub={status}
          color={healthColor}
          pct={healthPct}
        />

        <KpiTile
          label="Est. Time-to-Critical"
          value={rulStr}
          sub={prog?.trend_label ?? 'Awaiting data'}
          color={trendColor(prog?.trend)}
        />
      </div>

      {/* ── Standards Badge ──────────────────────────────────────── */}
      <div className="flex-shrink-0 ml-auto text-right hidden xl:block">
        <div className="text-[9px] text-slate-700 leading-relaxed space-y-px">
          <div>IEC 60076-7 Thermal Model</div>
          <div>IEC 60599 DGA · Duval Triangle</div>
          <div>IEEE C57.104 Gas Limits</div>
        </div>
      </div>

    </div>
  )
})
