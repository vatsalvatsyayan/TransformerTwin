// Maps a HealthComponentKey to emissive material properties based on live status

import { useStore } from '../store'
import type { HealthComponentKey } from '../types/health'

export interface HealthColorResult {
  emissive: string
  emissiveIntensity: number
}

export function useHealthColor(key: HealthComponentKey): HealthColorResult {
  const status = useStore((s) => s.components[key]?.status ?? 'NORMAL')
  switch (status) {
    case 'CAUTION':  return { emissive: '#ca8a04', emissiveIntensity: 0.35 }
    case 'WARNING':  return { emissive: '#ea580c', emissiveIntensity: 0.60 }
    case 'CRITICAL': return { emissive: '#dc2626', emissiveIntensity: 0.90 }
    default:         return { emissive: '#000000', emissiveIntensity: 0 }
  }
}
