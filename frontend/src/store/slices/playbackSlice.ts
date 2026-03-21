// Historical playback mode + position slice

export type PlaybackMode = 'live' | 'playback'

export interface PlaybackSlice {
  mode: PlaybackMode
  playbackPosition: string | null  // ISO 8601 timestamp
  isPlaying: boolean

  enterPlayback: (position: string) => void
  exitPlayback: () => void
  setPlaybackPosition: (position: string) => void
  setIsPlaying: (playing: boolean) => void
}

export const createPlaybackSlice = (
  set: (fn: (s: PlaybackSlice) => void) => void,
): PlaybackSlice => ({
  mode: 'live',
  playbackPosition: null,
  isPlaying: false,

  enterPlayback(position) {
    set((state) => {
      state.mode = 'playback'
      state.playbackPosition = position
      state.isPlaying = false
    })
  },

  exitPlayback() {
    set((state) => {
      state.mode = 'live'
      state.playbackPosition = null
      state.isPlaying = false
    })
  },

  setPlaybackPosition(position) {
    set((state) => {
      state.playbackPosition = position
    })
  },

  setIsPlaying(playing) {
    set((state) => {
      state.isPlaying = playing
    })
  },
})
