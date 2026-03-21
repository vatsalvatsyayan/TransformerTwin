// Oil pump cylinder

import { memo } from 'react'

export const OilPump = memo(function OilPump() {
  return (
    <mesh position={[0.6, -0.8, 0.8]} castShadow>
      <cylinderGeometry args={[0.15, 0.15, 0.5, 12]} />
      <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
    </mesh>
  )
})
