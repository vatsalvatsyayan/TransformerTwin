// Conservator expansion tank — horizontal cylinder + vertical support + fill pipe

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export interface ConservatorProps {
  onHover?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
}

export const Conservator = memo(function Conservator({ onHover, onHoverEnd, onClick }: ConservatorProps) {
  const { emissive, emissiveIntensity } = useHealthColor('oil_quality')

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover?.() }}
      onPointerOut={(e) => { e.stopPropagation(); onHoverEnd?.() }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      {/* Horizontal conservator cylinder */}
      <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 1.0, 18]} />
        <meshStandardMaterial
          color="#38546a"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.55}
          roughness={0.45}
        />
      </mesh>

      {/* End caps */}
      {([-0.5, 0.5] as const).map((z) => (
        <mesh key={z} position={[0, 2.0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 18]} />
          <meshStandardMaterial color="#2e4758" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* Vertical fill/breather pipe — from conservator down to tank lid */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 8]} />
        <meshStandardMaterial
          color="#2e4758"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * 0.5}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Silica gel breather (small box at pipe bottom) */}
      <mesh position={[0.25, 1.75, 0]} castShadow>
        <boxGeometry args={[0.15, 0.2, 0.12]} />
        <meshStandardMaterial color="#c8a84b" metalness={0.2} roughness={0.6} />
      </mesh>
    </group>
  )
})
