// Multi-fin radiator bank — 8 vertical cooling fins (instantiated ×2)

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export interface RadiatorBankProps {
  position: [number, number, number]
  onHover?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
}

const FIN_COUNT = 8
const FIN_SPACING = 0.115   // gap between fin centres in Z
const FIN_WIDTH = 0.055     // thickness in X (depth of fin)
const FIN_HEIGHT = 2.5      // same height as tank
const FIN_DEPTH = 0.07      // thin in Z

export const RadiatorBank = memo(function RadiatorBank({ position, onHover, onHoverEnd, onClick }: RadiatorBankProps) {
  const { emissive, emissiveIntensity } = useHealthColor('cooling')

  // Centre the fin array around Z = 0
  const totalSpan = (FIN_COUNT - 1) * FIN_SPACING
  const startZ = -totalSpan / 2

  return (
    <group
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); onHover?.() }}
      onPointerOut={(e) => { e.stopPropagation(); onHoverEnd?.() }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      {/* Vertical header pipe — connects all fins at top */}
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

      {/* Vertical footer pipe — connects all fins at bottom */}
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
    </group>
  )
})
