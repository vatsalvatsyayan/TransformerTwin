// Main transformer tank body — steel blue-gray with oil_temp health overlay

import { memo } from 'react'
import { useHealthColor } from '../../../hooks/useHealthColor'

export const Tank = memo(function Tank() {
  const { emissive, emissiveIntensity } = useHealthColor('oil_temp')

  return (
    <group>
      {/* Main tank body */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 2.8, 1.1]} />
        <meshStandardMaterial
          color="#38546a"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.55}
          roughness={0.45}
        />
      </mesh>

      {/* Top lid — slightly wider flange */}
      <mesh position={[0, 1.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.08, 0.06, 1.18]} />
        <meshStandardMaterial
          color="#2e4758"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Bottom mounting flange */}
      <mesh position={[0, -1.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.08, 0.06, 1.18]} />
        <meshStandardMaterial
          color="#2e4758"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Horizontal stiffener ribs (×3) for realistic corrugated look */}
      {[-0.7, 0, 0.7].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[2.04, 0.05, 1.14]} />
          <meshStandardMaterial
            color="#2c4357"
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            metalness={0.65}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  )
})
