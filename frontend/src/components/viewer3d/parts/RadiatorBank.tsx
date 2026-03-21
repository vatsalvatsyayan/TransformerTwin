// Flat panel radiator bank (instantiated ×2)

import { memo } from 'react'

export interface RadiatorBankProps {
  position: [number, number, number]
}

export const RadiatorBank = memo(function RadiatorBank({ position }: RadiatorBankProps) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[0.08, 2.5, 1.0]} />
      <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
    </mesh>
  )
})
