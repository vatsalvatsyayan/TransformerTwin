// Colored status indicator dot (4 states)

import { memo } from 'react'
import { STATUS_COLORS } from '../../lib/constants'

export interface StatusDotProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
} as const

export const StatusDot = memo(function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.NORMAL
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: color }}
      aria-label={status}
    />
  )
})
