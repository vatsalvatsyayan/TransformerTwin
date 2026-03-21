// On-Load Tap Changer (OLTC) box

import { memo } from 'react'

export const TapChanger = memo(function TapChanger() {
  return (
    <mesh position={[-1.3, 0.2, 0]} castShadow>
      <boxGeometry args={[0.4, 0.8, 0.6]} />
      <meshStandardMaterial color="#1e3a5f" metalness={0.4} roughness={0.6} />
    </mesh>
  )
})
