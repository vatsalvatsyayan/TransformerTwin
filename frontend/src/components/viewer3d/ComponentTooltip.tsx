// HTML overlay tooltip on component hover — placeholder

import { memo } from 'react'

export interface ComponentTooltipProps {
  label: string
  visible: boolean
  position: [number, number, number]
}

export const ComponentTooltip = memo(function ComponentTooltip({
  label,
  visible,
}: ComponentTooltipProps) {
  if (!visible) return null
  return (
    <div className="absolute pointer-events-none bg-[#252840] border border-[#3d4168] text-xs text-slate-200 px-2 py-1 rounded shadow-lg">
      {label}
    </div>
  )
})
