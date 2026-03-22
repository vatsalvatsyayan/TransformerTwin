// Fan unit disc (instantiated ×2) — ON/OFF colour + selection highlight for cooling

import { memo } from 'react'
import { useStore } from '../../../store'
import type { SensorId } from '../../../types/sensors'

export interface FanUnitProps {
  position: [number, number, number]
  sensorId: SensorId
  onHover?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
}

export const FanUnit = memo(function FanUnit({ position, sensorId, onHover, onHoverEnd, onClick }: FanUnitProps) {
  const reading = useStore((s) => s.readings[sensorId])
  const isSelected = useStore((s) => s.selectedHealthComponent === 'cooling')
  const isOn = reading ? reading.value > 0 : false

  // Selection overrides ON/OFF colors — bright cyan highlight
  const color = isSelected ? '#bae6fd' : (isOn ? '#22c55e' : '#475569')
  const emissive = isSelected ? '#38bdf8' : (isOn ? '#166534' : '#000000')
  const emissiveIntensity = isSelected ? 1.8 : (isOn ? 0.3 : 0)

  return (
    <mesh
      position={position}
      castShadow
      onPointerOver={(e) => { e.stopPropagation(); onHover?.() }}
      onPointerOut={(e) => { e.stopPropagation(); onHoverEnd?.() }}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      <cylinderGeometry args={[0.3, 0.3, 0.05, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        metalness={0.5}
        roughness={0.4}
      />
    </mesh>
  )
})
