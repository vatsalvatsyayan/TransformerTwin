// Multi-fin radiator bank — 8 vertical cooling fins + animated oil flow indicators
// When fans are active, animated upward-moving oil streams show active heat dissipation.

import { memo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { useHealthColor } from '../../../hooks/useHealthColor'
import { useStore } from '../../../store'

export interface RadiatorBankProps {
  position: [number, number, number]
  onHover?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
}

const FIN_COUNT   = 8
const FIN_SPACING = 0.115   // gap between fin centres in Z
const FIN_WIDTH   = 0.055   // thickness in X
const FIN_HEIGHT  = 2.5     // same height as tank
const FIN_DEPTH   = 0.07    // thin in Z

// ─── Oil Flow Stream ──────────────────────────────────────────────────────────

interface OilStreamProps {
  zOffset: number
  initialPhase: number  // stagger droplets so they don't all start at the same Y
}

/** A thin elongated particle that moves upward along a cooling fin channel. */
const OilStream = memo(function OilStream({ zOffset, initialPhase }: OilStreamProps) {
  const meshRef = useRef<Mesh>(null)
  const phaseRef = useRef(initialPhase)

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    // Move upward at 0.5 units/s (sim), loop when it exits the top of the radiator
    phaseRef.current = (phaseRef.current + delta * 0.5) % FIN_HEIGHT
    meshRef.current.position.y = -FIN_HEIGHT / 2 + phaseRef.current
    // Fade out near top for seamless loop
    const nearTop = phaseRef.current / FIN_HEIGHT  // 0 at bottom, 1 at top
    const opacity = nearTop > 0.82 ? Math.max(0, (1 - nearTop) / 0.18) : 0.4
    const mat = meshRef.current.material as { opacity: number }
    mat.opacity = opacity
  })

  return (
    <mesh ref={meshRef} position={[0, 0, zOffset]}>
      <boxGeometry args={[FIN_WIDTH * 0.4, 0.16, FIN_DEPTH * 0.35]} />
      <meshStandardMaterial
        color="#7dd3fc"
        transparent
        opacity={0.4}
        emissive="#38bdf8"
        emissiveIntensity={0.55}
        depthWrite={false}
      />
    </mesh>
  )
})

// ─── RadiatorBank ─────────────────────────────────────────────────────────────

export const RadiatorBank = memo(function RadiatorBank({ position, onHover, onHoverEnd, onClick }: RadiatorBankProps) {
  const { emissive, emissiveIntensity } = useHealthColor('cooling')

  // Determine whether any cooling element is ON
  const fan1Status = useStore((s) => s.readings['FAN_BANK_1']?.status)
  const fan2Status = useStore((s) => s.readings['FAN_BANK_2']?.status)
  const pumpStatus = useStore((s) => s.readings['OIL_PUMP_1']?.status)
  const coolingActive = fan1Status === 'ON' || fan2Status === 'ON' || pumpStatus === 'ON'

  // Centre the fin array around Z = 0
  const totalSpan = (FIN_COUNT - 1) * FIN_SPACING
  const startZ    = -totalSpan / 2

  // Oil flow stream Z offsets — one per inter-fin channel
  const streamZOffsets = Array.from({ length: FIN_COUNT - 1 }, (_, i) =>
    startZ + i * FIN_SPACING + FIN_SPACING / 2,
  )

  return (
    <group
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); onHover?.() }}
      onPointerOut={(e)  => { e.stopPropagation(); onHoverEnd?.() }}
      onClick={(e)       => { e.stopPropagation(); onClick?.() }}
    >
      {/* Vertical header pipe */}
      <mesh position={[0, FIN_HEIGHT / 2 - 0.05, 0]} castShadow>
        <boxGeometry args={[FIN_WIDTH * 0.8, 0.08, totalSpan + FIN_DEPTH + 0.04]} />
        <meshStandardMaterial
          color="#2e4758"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.65}
          roughness={0.35}
        />
      </mesh>

      {/* Vertical footer pipe */}
      <mesh position={[0, -FIN_HEIGHT / 2 + 0.05, 0]} castShadow>
        <boxGeometry args={[FIN_WIDTH * 0.8, 0.08, totalSpan + FIN_DEPTH + 0.04]} />
        <meshStandardMaterial
          color="#2e4758"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.65}
          roughness={0.35}
        />
      </mesh>

      {/* Individual cooling fins */}
      {Array.from({ length: FIN_COUNT }, (_, i) => (
        <mesh key={i} position={[0, 0, startZ + i * FIN_SPACING]} castShadow>
          <boxGeometry args={[FIN_WIDTH, FIN_HEIGHT, FIN_DEPTH]} />
          <meshStandardMaterial
            color="#304e62"
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* Animated oil circulation streams — only when cooling is active */}
      {coolingActive && streamZOffsets.map((z, i) => (
        <OilStream
          key={i}
          zOffset={z}
          initialPhase={(i / streamZOffsets.length) * FIN_HEIGHT}
        />
      ))}
    </group>
  )
})
