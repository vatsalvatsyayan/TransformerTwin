// On-Load Tap Changer (OLTC) — control box mounted on tank side

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export const TapChanger = memo(function TapChanger() {
  const { emissive, emissiveIntensity } = useHealthColor('winding_temp')

  return (
    <group position={[-1.1, 0.3, 0]}>
      {/* Main OLTC housing */}
      <mesh castShadow>
        <boxGeometry args={[0.22, 0.75, 0.55]} />
        <meshStandardMaterial
          color="#1e3a5f"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.45}
          roughness={0.55}
        />
      </mesh>

      {/* Head (top dome of tap changer) */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.1, 12]} />
        <meshStandardMaterial color="#162d4a" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Drive shaft cap */}
      <mesh position={[-0.13, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 8]} />
        <meshStandardMaterial color="#8a9aaa" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  )
})
