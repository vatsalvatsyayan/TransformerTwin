// Buchholz relay (small cylinder on conservator pipe)

import { memo } from 'react'

export const BuchholzRelay = memo(function BuchholzRelay() {
  return (
    <mesh position={[0.4, 2.0, 0]} castShadow>
      <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
      <meshStandardMaterial color="#fbbf24" metalness={0.3} roughness={0.5} />
    </mesh>
  )
})
