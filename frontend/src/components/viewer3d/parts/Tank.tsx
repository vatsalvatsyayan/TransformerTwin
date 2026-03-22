// Main transformer tank body — thermal gradient from BOT_OIL_TEMP (bottom) to TOP_OIL_TEMP (top)
// This is the core digital-twin visual: you can SEE where heat accumulates in the oil column.

import { memo } from 'react'
import { useStore } from '../../../store'
import { useHealthColor } from '../../../hooks/useHealthColor'

// ─── Temperature → emissive color mapping ───────────────────────────────────

interface EmissiveProps {
  emissive: string
  emissiveIntensity: number
}

/** Maps an oil temperature value to an emissive glow for a tank slice. */
function tempToEmissive(tempC: number | undefined): EmissiveProps {
  if (tempC == null) return { emissive: '#000000', emissiveIntensity: 0 }
  if (tempC >= 95)   return { emissive: '#dc2626', emissiveIntensity: 1.10 }  // CRITICAL red
  if (tempC >= 85)   return { emissive: '#ea580c', emissiveIntensity: 0.75 }  // WARNING orange-red
  if (tempC >= 75)   return { emissive: '#f97316', emissiveIntensity: 0.50 }  // CAUTION orange
  if (tempC >= 65)   return { emissive: '#f59e0b', emissiveIntensity: 0.28 }  // warm amber
  if (tempC >= 50)   return { emissive: '#ca8a04', emissiveIntensity: 0.12 }  // faint yellow
  return { emissive: '#000000', emissiveIntensity: 0 }
}

/** Linearly interpolate between two emissive props at fraction t (0=a, 1=b). */
function lerpEmissive(a: EmissiveProps, b: EmissiveProps, t: number): EmissiveProps {
  const lerp = (x: number, y: number) => x + (y - x) * t
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
  }
  const rgbToHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2,'0')).join('')
  const [ar,ag,ab] = hexToRgb(a.emissive)
  const [br,bg,bb] = hexToRgb(b.emissive)
  return {
    emissive: rgbToHex(lerp(ar,br), lerp(ag,bg), lerp(ab,bb)),
    emissiveIntensity: lerp(a.emissiveIntensity, b.emissiveIntensity),
  }
}

// ─── Tank Slice ──────────────────────────────────────────────────────────────

interface TankSliceProps {
  yCenter: number
  height: number
  emissive: string
  emissiveIntensity: number
  color?: string
  metalness?: number
  roughness?: number
  width?: number
  depth?: number
}

const TankSlice = memo(function TankSlice({
  yCenter, height, emissive, emissiveIntensity,
  color = '#38546a', metalness = 0.55, roughness = 0.45,
  width = 2, depth = 1.1,
}: TankSliceProps) {
  return (
    <mesh position={[0, yCenter, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  )
})

// ─── Tank Component ──────────────────────────────────────────────────────────

export interface TankProps {
  onHover?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
}

export const Tank = memo(function Tank({ onHover, onHoverEnd, onClick }: TankProps) {
  // Health-driven emissive (used for selection highlight / health status overlay)
  const healthEmissive = useHealthColor('oil_temp')

  // Live temperature readings for gradient
  const botTemp = useStore((s) => s.readings['BOT_OIL_TEMP']?.value)
  const topTemp = useStore((s) => s.readings['TOP_OIL_TEMP']?.value)

  // Temperature emissive at each pole
  const botColor = tempToEmissive(botTemp)
  const topColor = tempToEmissive(topTemp)

  // 5 slices: t = 0 (bottom) → 1 (top)
  // Each slice yCenter is relative to tank origin (tank body spans y ∈ [-1.4, +1.4])
  const TANK_H = 2.8
  const SLICE_COUNT = 5
  const sliceH = TANK_H / SLICE_COUNT // 0.56 each

  const slices = Array.from({ length: SLICE_COUNT }, (_, i) => {
    const t = i / (SLICE_COUNT - 1)           // 0, 0.25, 0.5, 0.75, 1
    const yCenter = -TANK_H / 2 + sliceH * (i + 0.5) // evenly spaced centres
    const tempEmissive = lerpEmissive(botColor, topColor, t)

    // When health component is selected, the health emissive overrides temp gradient
    const resolvedEmissive =
      healthEmissive.emissiveIntensity > 0 ? healthEmissive : tempEmissive

    return { t, yCenter, ...resolvedEmissive }
  })

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover?.() }}
      onPointerOut={(e)  => { e.stopPropagation(); onHoverEnd?.() }}
      onClick={(e)       => { e.stopPropagation(); onClick?.() }}
    >
      {/* Main tank body — 5 thermal gradient slices */}
      {slices.map((s, i) => (
        <TankSlice
          key={i}
          yCenter={s.yCenter}
          height={sliceH + 0.001} // +0.001 prevents micro-gap between slices
          emissive={s.emissive}
          emissiveIntensity={s.emissiveIntensity}
        />
      ))}

      {/* Top lid — slightly wider flange */}
      <TankSlice
        yCenter={1.42}
        height={0.06}
        width={2.08}
        depth={1.18}
        emissive={topColor.emissive}
        emissiveIntensity={topColor.emissiveIntensity}
        color="#2e4758"
        metalness={0.6}
        roughness={0.4}
      />

      {/* Bottom mounting flange */}
      <TankSlice
        yCenter={-1.42}
        height={0.06}
        width={2.08}
        depth={1.18}
        emissive={botColor.emissive}
        emissiveIntensity={botColor.emissiveIntensity}
        color="#2e4758"
        metalness={0.6}
        roughness={0.4}
      />

      {/* Horizontal stiffener ribs (×3) */}
      {([-0.7, 0, 0.7] as const).map((y) => {
        const t = (y + 1.4) / 2.8 // normalize to [0,1]
        const ribColor = lerpEmissive(botColor, topColor, t)
        const resolved = healthEmissive.emissiveIntensity > 0 ? healthEmissive : ribColor
        return (
          <TankSlice
            key={y}
            yCenter={y}
            height={0.05}
            width={2.04}
            depth={1.14}
            emissive={resolved.emissive}
            emissiveIntensity={resolved.emissiveIntensity}
            color="#2c4357"
            metalness={0.65}
            roughness={0.4}
          />
        )
      })}
    </group>
  )
})
