// Fan unit disc (instantiated ×2)

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
  const isOn = reading ? reading.value > 0 : false

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
        color={isOn ? '#22c55e' : '#475569'}
        emissive={isOn ? '#166534' : '#000000'}
        metalness={0.5}
        roughness={0.4}
      />
    </mesh>
  )
})
