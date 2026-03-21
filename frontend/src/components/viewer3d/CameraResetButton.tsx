// Button to reset orbit controls camera

import { memo } from 'react'

export interface CameraResetButtonProps {
  onReset: () => void
}

export const CameraResetButton = memo(function CameraResetButton({ onReset }: CameraResetButtonProps) {
  return (
    <button
      onClick={onReset}
      className="absolute top-3 right-3 bg-white/70 backdrop-blur-sm border border-slate-300 text-slate-700 text-xs px-2 py-1 rounded hover:bg-white/90 transition-colors shadow"
    >
      Reset Camera
    </button>
  )
})
