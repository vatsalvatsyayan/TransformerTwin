// Button to reset orbit controls camera

import { memo } from 'react'

export interface CameraResetButtonProps {
  onReset: () => void
}

export const CameraResetButton = memo(function CameraResetButton({ onReset }: CameraResetButtonProps) {
  return (
    <button
      onClick={onReset}
      className="absolute top-3 right-3 bg-[#252840] border border-[#3d4168] text-slate-400 text-xs px-2 py-1 rounded hover:bg-[#2d3148] transition-colors"
    >
      Reset Camera
    </button>
  )
})
