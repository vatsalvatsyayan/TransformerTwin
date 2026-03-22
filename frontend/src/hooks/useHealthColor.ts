// Maps a HealthComponentKey to emissive material properties based on live status.
// When the component is selected (clicked in HealthBreakdown), returns a bright
// cyan pulse to drive 3D highlighting regardless of current health status.

import { useStore } from '../store'
import type { HealthComponentKey } from '../types/health'

export interface HealthColorResult {
  emissive: string
  emissiveIntensity: number
}

export function useHealthColor(key: HealthComponentKey): HealthColorResult {
  const status = useStore((s) => s.components[key]?.status ?? 'NORMAL')
  const isSelected = useStore((s) => s.selectedHealthComponent === key)

  if (isSelected) {
    // Bright cyan pulse — visually distinct from all health status colors
    return { emissive: '#38bdf8', emissiveIntensity: 1.8 }
  }

  switch (status) {
    case 'CAUTION':  return { emissive: '#ca8a04', emissiveIntensity: 0.35 }
    case 'WARNING':  return { emissive: '#ea580c', emissiveIntensity: 0.60 }
    case 'CRITICAL': return { emissive: '#dc2626', emissiveIntensity: 0.90 }
    default:         return { emissive: '#000000', emissiveIntensity: 0 }
  }
}
