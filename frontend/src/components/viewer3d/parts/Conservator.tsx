// Conservator tank (cylinder on top)

import { memo } from 'react'

export const Conservator = memo(function Conservator() {
  return (
    <mesh position={[0, 2.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.25, 0.25, 1.2, 16]} />
      <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
    </mesh>
  )
})
