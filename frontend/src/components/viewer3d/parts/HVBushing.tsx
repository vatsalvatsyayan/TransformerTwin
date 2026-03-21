// HV porcelain bushing — main shaft with 3 petticoat skirt discs (instantiated ×3)

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export interface HVBushingProps {
  position: [number, number, number]
}

// Skirt disc Y-offsets along the shaft (shaft total height = 1.3)
const SKIRT_Y = [-0.35, 0.05, 0.42]

export const HVBushing = memo(function HVBushing({ position }: HVBushingProps) {
  const { emissive, emissiveIntensity } = useHealthColor('bushing')

  return (
    <group position={position}>
      {/* Main porcelain shaft */}
      <mesh castShadow>
        <cylinderGeometry args={[0.045, 0.055, 1.3, 10]} />
        <meshStandardMaterial
          color="#e8e2d4"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.05}
          roughness={0.75}
        />
      </mesh>

      {/* Metal terminal cap at top */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.06, 8]} />
        <meshStandardMaterial
          color="#8a8a7a"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * 0.5}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Petticoat skirt discs */}
      {SKIRT_Y.map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.135, 0.135, 0.045, 14]} />
          <meshStandardMaterial
            color="#ddd8cb"
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            metalness={0.04}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* Mounting flange at base */}
      <mesh position={[0, -0.68, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.06, 8]} />
        <meshStandardMaterial
          color="#4a5568"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * 0.5}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
})
