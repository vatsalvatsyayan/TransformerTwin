// Single HV bushing (instantiated ×3)

import { memo } from 'react'

export interface HVBushingProps {
  position: [number, number, number]
}

export const HVBushing = memo(function HVBushing({ position }: HVBushingProps) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.06, 0.1, 1.0, 8]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.6} />
    </mesh>
  )
})
