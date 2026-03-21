// Main transformer tank body (semi-transparent)

import { memo } from 'react'

export const Tank = memo(function Tank() {
  return (
    <mesh position={[0, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[2, 3, 1.2]} />
      <meshStandardMaterial color="#334155" transparent opacity={0.85} metalness={0.6} roughness={0.4} />
    </mesh>
  )
})
