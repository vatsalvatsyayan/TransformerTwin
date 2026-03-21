// Alert count badge for the header

import { memo } from 'react'
import { useActiveAlertCount } from '../../store/selectors'

export const AlertBadge = memo(function AlertBadge() {
  const count = useActiveAlertCount()
  if (count === 0) return null

  return (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  )
})
