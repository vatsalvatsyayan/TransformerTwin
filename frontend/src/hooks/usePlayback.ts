// Playback state machine hook

import { useStore } from '../store'

export interface UsePlaybackResult {
  isLive: boolean
  isPlaying: boolean
  playbackPosition: string | null
  enterPlayback: (position: string) => void
  exitPlayback: () => void
  seek: (position: string) => void
  play: () => void
  pause: () => void
}

/** Controls the historical playback mode and position. */
export function usePlayback(): UsePlaybackResult {
  const mode = useStore((s) => s.mode)
  const isPlaying = useStore((s) => s.isPlaying)
  const playbackPosition = useStore((s) => s.playbackPosition)
  const enterPlayback = useStore((s) => s.enterPlayback)
  const exitPlayback = useStore((s) => s.exitPlayback)
  const setPlaybackPosition = useStore((s) => s.setPlaybackPosition)
  const setIsPlaying = useStore((s) => s.setIsPlaying)

  return {
    isLive: mode === 'live',
    isPlaying,
    playbackPosition,
    enterPlayback,
    exitPlayback,
    seek: setPlaybackPosition,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
  }
}
