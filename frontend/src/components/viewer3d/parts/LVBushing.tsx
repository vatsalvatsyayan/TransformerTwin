// LV porcelain bushing — shorter than HV, 2 petticoat skirts (instantiated ×3)

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export interface LVBushingProps {
  position: [number, number, number]
}

const SKIRT_Y = [-0.18, 0.18]

export const LVBushing = memo(function LVBushing({ position }: LVBushingProps) {
  const { emissive, emissiveIntensity } = useHealthColor('bushing')

  return (
    <group position={position}>
      {/* Main porcelain shaft */}
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.065, 0.85, 10]} />
        <meshStandardMaterial
          color="#e2ddd0"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.04}
          roughness={0.78}
        />
      </mesh>

      {/* Metal terminal cap */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.05, 8]} />
        <meshStandardMaterial color="#8a8a7a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Petticoat skirt discs */}
      {SKIRT_Y.map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.115, 0.115, 0.04, 12]} />
          <meshStandardMaterial
            color="#d8d4c8"
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            metalness={0.04}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* Mounting flange at base */}
      <mesh position={[0, -0.44, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 8]} />
        <meshStandardMaterial color="#4a5568" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
})
