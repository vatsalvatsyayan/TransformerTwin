// Detail panel rendered when a 3D part is clicked — shows health status + sensor readings + fault diagnosis

import { memo } from 'react'
import { useStore } from '../../store'
import { PART_META } from '../../types/parts'
import type { PartId } from '../../types/parts'
import { SENSOR_META, STATUS_COLORS } from '../../lib/constants'
import type { SensorId } from '../../types/sensors'
import type { FMEAActiveMode } from '../../types/fmea'

export interface PartDetailPanelProps {
  partId: PartId
  onClose: () => void
}

const HEALTH_LABEL: Record<string, string> = {
  oil_temp: 'Oil Temperature',
  oil_quality: 'Oil Quality',
  bushing: 'Bushing Integrity',
  cooling: 'Cooling System',
  winding_temp: 'Winding Temperature',
  dga: 'DGA / Gas Analysis',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  Probable:   '#dc2626',  // red
  Possible:   '#f97316',  // orange
  Monitoring: '#f59e0b',  // amber
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.NORMAL
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span style={{ color }}>{status}</span>
    </span>
  )
}

function ConfidenceBadge({ label }: { label: string }) {
  const color = CONFIDENCE_COLORS[label] ?? CONFIDENCE_COLORS.Monitoring
  return (
    <span
      className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}66` }}
    >
      {label}
    </span>
  )
}

function SensorRow({ sensorId }: { sensorId: SensorId }) {
  const reading = useStore((s) => s.readings[sensorId])
  const meta = SENSOR_META[sensorId]

  if (!reading || !meta) return null

  const isEquipment = reading.status === 'ON' || reading.status === 'OFF'
  const displayValue = isEquipment
    ? reading.status
    : typeof reading.value === 'number'
    ? reading.value.toFixed(1)
    : String(reading.value)
  const displayUnit = isEquipment ? '' : meta.unit

  const statusColor =
    STATUS_COLORS[reading.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.NORMAL

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#2a3050] last:border-0 gap-2">
      <span className="text-slate-400 text-xs truncate flex-1">{meta.label}</span>
      <span className="text-white text-xs font-mono flex-shrink-0">
        {displayValue}
        {displayUnit && <span className="text-slate-500 ml-0.5">{displayUnit}</span>}
      </span>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
    </div>
  )
}

function FaultDiagnosisSection({
  healthStatus,
  modes,
}: {
  healthStatus: string
  modes: FMEAActiveMode[]
}) {
  const isNormal = healthStatus === 'NORMAL'

  return (
    <div className="px-4 py-3 border-b border-[#2a3050]">
      <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">
        Fault Diagnosis
      </div>

      {isNormal ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span>✓</span>
          <span>No active fault modes detected</span>
        </div>
      ) : modes.length === 0 ? (
        <p className="text-slate-400 text-xs">
          Monitor sensor trends closely. No specific failure pattern matched yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {modes.slice(0, 2).map((mode) => (
            <div key={mode.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-200 text-xs font-medium leading-tight">{mode.name}</span>
                <ConfidenceBadge label={mode.confidence_label} />
              </div>
              <div className="flex flex-col gap-0.5">
                {mode.recommended_actions.slice(0, 2).map((action, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <span className="text-slate-600 mt-0.5 flex-shrink-0">›</span>
                    <span className="leading-snug">{action}</span>
                  </div>
                ))}
                {mode.recommended_actions.length > 2 && (
                  <div className="text-[10px] text-slate-600 ml-3.5">
                    +{mode.recommended_actions.length - 2} more in FMEA tab
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const PartDetailPanel = memo(function PartDetailPanel({
  partId,
  onClose,
}: PartDetailPanelProps) {
  const meta = PART_META[partId]
  const healthComp = useStore((s) =>
    meta.healthKey ? s.components[meta.healthKey] : undefined
  )
  const fmeaResponse = useStore((s) => s.response)

  // Filter FMEA active modes that affect this part's health component
  const relevantModes: FMEAActiveMode[] = meta.healthKey && fmeaResponse?.active_modes
    ? [...fmeaResponse.active_modes]
        .filter((m) => m.affected_components.includes(meta.healthKey!))
        .sort((a, b) => b.severity - a.severity)
    : []

  const healthStatus = healthComp?.status ?? 'NORMAL'

  return (
    <div className="absolute right-0 top-0 h-full w-72 bg-[#131928]/95 backdrop-blur-sm border-l border-[#2a3050] flex flex-col z-10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3050] flex-shrink-0">
        <span className="text-white font-semibold text-sm">{meta.label}</span>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors text-lg leading-none ml-2"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        <div className="px-4 py-3 border-b border-[#2a3050]">
          <p className="text-slate-400 text-xs leading-relaxed italic">{meta.description}</p>
        </div>

        {/* Health component status */}
        {meta.healthKey && (
          <div className="px-4 py-3 border-b border-[#2a3050]">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">
              Health Component
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs">
                {HEALTH_LABEL[meta.healthKey] ?? meta.healthKey}
              </span>
              <StatusBadge status={healthStatus} />
            </div>
            {healthComp?.contribution !== undefined && (
              <div className="mt-1.5 text-slate-500 text-xs">
                Contribution:{' '}
                <span className="text-slate-300">{healthComp.contribution.toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Fault diagnosis — always shown for parts with a health component */}
        {meta.healthKey && (
          <FaultDiagnosisSection
            healthStatus={healthStatus}
            modes={relevantModes}
          />
        )}

        {/* Sensor readings */}
        <div className="px-4 py-3">
          <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">
            Sensor Readings
          </div>
          <div>
            {meta.sensorIds.map((id) => (
              <SensorRow key={id} sensorId={id} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
