// Buchholz relay — gas-actuated protective relay on the conservator pipe

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export const BuchholzRelay = memo(function BuchholzRelay() {
  const { emissive, emissiveIntensity } = useHealthColor('dga')

  return (
    <group position={[0.3, 1.78, 0]}>
      {/* Main relay housing */}
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.16, 0.14]} />
        <meshStandardMaterial
          color="#c8a030"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.35}
          roughness={0.55}
        />
      </mesh>

      {/* Test cock / valve on side */}
      <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.08, 6]} />
        <meshStandardMaterial color="#7a7060" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Signal cable lug */}
      <mesh position={[0, 0.1, 0.05]} castShadow>
        <boxGeometry args={[0.05, 0.06, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  )
})
