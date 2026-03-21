// Oil circulation pump — cylindrical body with inlet/outlet flanges

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export interface OilPumpProps {
  onHover?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
}

export const OilPump = memo(function OilPump({ onHover, onHoverEnd, onClick }: OilPumpProps) {
  const { emissive, emissiveIntensity } = useHealthColor('cooling')

  return (
    <group
      position={[0.75, -0.7, 0.75]}
      onPointerOver={(e) => { e.stopPropagation(); onHover?.() }}
      onPointerOut={(e) => { e.stopPropagation(); onHoverEnd?.() }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      {/* Main pump body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.45, 12]} />
        <meshStandardMaterial
          color="#3a4048"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.65}
          roughness={0.4}
        />
      </mesh>

      {/* Outlet pipe stub (horizontal) */}
      <mesh position={[0.14, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
        <meshStandardMaterial color="#2c3540" metalness={0.65} roughness={0.4} />
      </mesh>

      {/* Inlet pipe stub (downward) */}
      <mesh position={[0, -0.28, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.14, 8]} />
        <meshStandardMaterial color="#2c3540" metalness={0.65} roughness={0.4} />
      </mesh>

      {/* Motor housing cap at top */}
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.1, 12]} />
        <meshStandardMaterial
          color="#4a5260"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * 0.6}
          metalness={0.55}
          roughness={0.5}
        />
      </mesh>
    </group>
  )
})
