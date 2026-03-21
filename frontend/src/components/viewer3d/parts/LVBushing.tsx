// Single LV bushing (instantiated ×3)

import { memo } from 'react'

export interface LVBushingProps {
  position: [number, number, number]
}

export const LVBushing = memo(function LVBushing({ position }: LVBushingProps) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.08, 0.12, 0.7, 8]} />
      <meshStandardMaterial color="#64748b" metalness={0.3} roughness={0.6} />
    </mesh>
  )
})
